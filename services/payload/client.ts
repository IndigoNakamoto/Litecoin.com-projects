import axios, { AxiosInstance } from 'axios'

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '')
}

// Read at runtime (bracket notation avoids any build-time inlining of env)
function getEnv(key: string): string | undefined {
  return process.env[key]
}

function resolvePayloadApiUrl(): string {
  const usePayload = getEnv('USE_PAYLOAD_CMS')?.trim().toLowerCase()
  const isPayloadEnabled = usePayload === 'true' || usePayload === '1' || usePayload === 'yes' || usePayload === 'on'

  // Explicit API URL always wins
  const explicitUrl = getEnv('PAYLOAD_API_URL')
  if (explicitUrl) {
    // On host: Next.js is 3000, Payload is 3011 — override so we hit Payload. In Docker, URL is e.g.
    // http://litecoin-fund-cms:3000/api (different host); never replace port for non-localhost.
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(explicitUrl)
    if (isPayloadEnabled && isLocalhost && explicitUrl.includes(':3000')) {
      if (getEnv('NODE_ENV') === 'development') {
        console.warn(`[resolvePayloadApiUrl] PAYLOAD_API_URL points to port 3000 but USE_PAYLOAD_CMS is enabled. Using port 3011 instead.`)
      }
      return explicitUrl.replace(':3000', ':3011')
    }
    return explicitUrl
  }

  // Allow setting a base server URL and deriving the REST prefix
  const cmsUrl = getEnv('PAYLOAD_CMS_URL')
  if (cmsUrl) {
    const base = stripTrailingSlashes(cmsUrl)
    return `${base}/api`
  }

  // Migration convenience: if toggled on and no URL is set, assume the local
  // Payload instance is running on 3011 (to avoid conflicts with other projects).
  if (isPayloadEnabled) {
    return 'http://localhost:3011/api'
  }

  // Default from the integration guide (should NOT be used when USE_PAYLOAD_CMS is true)
  return 'http://localhost:3000/api'
}

// Resolve URL at runtime, not module load time, to ensure env vars are available
function getPayloadApiUrl(): string {
  return resolvePayloadApiUrl()
}

export function resolvePayloadServerUrl(): string {
  const PAYLOAD_API_URL = getPayloadApiUrl()
  const cmsUrl = getEnv('PAYLOAD_CMS_URL')
  if (cmsUrl) return stripTrailingSlashes(cmsUrl)
  // Derive from API URL (strip /api suffix if present)
  if (PAYLOAD_API_URL.endsWith('/api')) return PAYLOAD_API_URL.slice(0, -'/api'.length)
  return PAYLOAD_API_URL
}

export function resolvePayloadAssetUrl(url?: string): string | undefined {
  if (!url) return undefined
  // Already absolute
  if (/^https?:\/\//i.test(url)) return url
  // Payload typically returns media URLs like "/media/xyz.jpg"
  if (url.startsWith('/')) return `${resolvePayloadServerUrl()}${url}`
  return url
}

export type PayloadClientOptions = {
  /**
   * Authenticate as a CMS user. Required to read drafts.
   * Never enable this for production public project reads — that would leak unpublished work.
   */
  authenticate?: boolean
}

function authorizationHeader(apiToken: string): string {
  // JWT (three segments) uses Payload's JWT scheme; otherwise treat as a users API key.
  if (apiToken.split('.').length === 3) {
    return `JWT ${apiToken}`
  }
  return `users API-Key ${apiToken}`
}

/**
 * Create a Payload CMS API client
 */
export function createPayloadClient(options: PayloadClientOptions = {}): AxiosInstance {
  const apiToken = getEnv('PAYLOAD_API_TOKEN')
  // Always resolve URL at runtime to ensure fresh env vars
  const apiUrl = resolvePayloadApiUrl()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.authenticate && apiToken) {
    headers.Authorization = authorizationHeader(apiToken)
  }

  // Debug logging in development (can be enabled for troubleshooting)
  // if (process.env.NODE_ENV === 'development') {
  //   console.log(`[createPayloadClient] Environment check:`)
  //   console.log(`  - PAYLOAD_API_URL: ${process.env.PAYLOAD_API_URL || 'not set'}`)
  //   console.log(`  - PAYLOAD_CMS_URL: ${process.env.PAYLOAD_CMS_URL || 'not set'}`)
  //   console.log(`  - USE_PAYLOAD_CMS: ${process.env.USE_PAYLOAD_CMS || 'not set'}`)
  //   console.log(`  - Resolved API URL: ${apiUrl}`)
  // }

  return axios.create({
    baseURL: apiUrl,
    headers,
  })
}

/**
 * Helper to fetch paginated results from Payload
 */
export async function fetchAllPages<T>(
  client: AxiosInstance,
  endpoint: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const allItems: T[] = []
  let page = 1
  const limit = 100 // Payload default limit

  while (true) {
    // Ensure depth is set for proper relationship population (default to 2 if not specified)
    // Put depth after params spread so it can't be overridden, unless explicitly set in params
    const requestParams = {
      ...params,
      depth: params?.depth ?? 2, // Default to 2 for relationship population, but allow override
      page,
      limit,
    }

    if (process.env.NODE_ENV === 'development') {
      const fullUrl = `${client.defaults.baseURL}${endpoint}?${new URLSearchParams(Object.entries(requestParams).map(([k, v]) => [k, String(v)])).toString()}`
      console.log(`[fetchAllPages] Requesting: ${fullUrl}`)
    }

    const response = await client.get(endpoint, { params: requestParams })
    
    if (process.env.NODE_ENV === 'development') {
      const actualUrl = response.request?.res?.responseUrl || response.config.url || 'unknown'
      console.log(`[fetchAllPages] Response status: ${response.status}`)
      console.log(`[fetchAllPages] Response data structure:`, {
        isArray: Array.isArray(response.data),
        hasDocs: !!response.data?.docs,
        docsLength: response.data?.docs?.length,
        totalDocs: response.data?.totalDocs,
        totalPages: response.data?.totalPages,
      })
    }

    // Handle error responses
    if (!response.data) {
      console.error('Payload API returned no data:', response.status, response.statusText)
      break
    }

    // Handle error structure (Payload might return { errors: [...] } on error)
    if (response.data.errors) {
      console.error('Payload API returned errors:', response.data.errors)
      break
    }

    // Handle array response - this should NOT happen for Payload CMS endpoints
    // Payload CMS returns { docs: [], totalDocs, totalPages, ... }
    // If we get an array, we might be hitting the wrong endpoint (e.g., Next.js API route)
    if (Array.isArray(response.data)) {
      // Log warning in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[fetchAllPages] Received array response - expected Payload CMS paginated response')
        console.warn('[fetchAllPages] This might indicate hitting the wrong endpoint:', endpoint)
      }
      allItems.push(...response.data)
      break
    }

    const { docs, totalPages, totalDocs } = response.data

    if (!docs || !Array.isArray(docs)) {
      console.error('Payload API response missing docs array. Response:', JSON.stringify(response.data).substring(0, 200))
      break
    }

    allItems.push(...docs)

    // Break if we've fetched all items or reached the last page
    if (!totalPages || page >= totalPages || (totalDocs && allItems.length >= totalDocs)) {
      break
    }

    page++
  }

  return allItems
}



