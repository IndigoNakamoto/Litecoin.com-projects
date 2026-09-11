import { kv } from '@/lib/kv'
import { createWebflowClient, listCollectionItems } from './client'
import { getProjectBySlug } from './projects'

const CACHE_TTL = 259200 // 3 days in seconds

export interface Update {
  id: string
  isDraft: boolean
  isArchived: boolean
  fieldData: {
    name?: string
    title?: string
    summary?: string
    content?: string
    project?: string
    createdOn?: string
    date?: string
    authorTwitterHandle?: string
    tags?: string[]
  }
}

/**
 * Get updates for a specific project by its slug.
 * @param slug - The slug of the project.
 * @returns An array of Updates related to the project or an empty array if the project is not found.
 */
export async function getUpdatesByProjectSlug(
  slug: string,
  _options?: { includeDrafts?: boolean },
): Promise<Update[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug)

    if (!project) {
      console.warn(`[getUpdatesByProjectSlug] No project found with slug "${slug}".`)
      return []
    }

    // Use the project ID to get updates
    return await getUpdatesByProjectId(project.id)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[getUpdatesByProjectSlug] Error fetching updates for slug "${slug}":`, errorMessage)
    return []
  }
}

/**
 * Get updates for a specific project by its ID.
 * @param projectId - The ID of the project.
 * @returns An array of Updates related to the project.
 */
export async function getUpdatesByProjectId(projectId: string): Promise<Update[]> {
  const cacheKey = `updates:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedUpdates = await kv.get<Update[]>(cacheKey)
    if (cachedUpdates) {
      return cachedUpdates
    }
  } catch (error) {
    // KV not available, continue
  }

  const apiToken = process.env.WEBFLOW_API_TOKEN
  const collectionId = process.env.WEBFLOW_COLLECTION_ID_PROJECT_UPDATES

  if (!apiToken || !collectionId) {
    console.error('[getUpdatesByProjectId] Webflow API credentials not configured')
    return []
  }

  const client = createWebflowClient(apiToken)
  
  try {
    const allUpdates = await listCollectionItems<Update>(client, collectionId)

    // If rate limited, listCollectionItems returns empty array, so we'll return empty array
    if (allUpdates.length === 0) {
      console.warn(`[getUpdatesByProjectId] No updates returned (may be rate limited), trying cache...`)
      // Try to get from cache as fallback
      try {
        const cached = await kv.get<Update[]>(cacheKey)
        if (cached) {
          return cached
        }
      } catch (_cacheError) {
        // Cache not available
      }
      return []
    }

    // Filter updates by project ID and exclude drafts and archived items
    const projectUpdates = allUpdates.filter(
      (update) =>
        update.fieldData.project === projectId &&
        !update.isDraft &&
        !update.isArchived
    )

    // Cache the updates
    try {
      await kv.set(cacheKey, projectUpdates, { ex: CACHE_TTL })
    } catch (_error) {
      // KV not available, continue
    }

    return projectUpdates
  } catch (error: unknown) {
    // If we get an error (other than rate limit which is handled in listCollectionItems),
    // try to use cached data if available
    const axiosError = error as { response?: { status?: number }; message?: string }
    console.warn(
      `[getUpdatesByProjectId] Error fetching updates, trying cached data...`,
      axiosError.response?.status || axiosError.message
    )
    try {
      const cached = await kv.get<Update[]>(cacheKey)
      if (cached) {
        return cached
      }
    } catch (_cacheError) {
      // Cache not available
    }
    
    // Return empty array to allow graceful degradation
    console.warn(`[getUpdatesByProjectId] No cached updates available, returning empty array`)
    return []
  }
}

