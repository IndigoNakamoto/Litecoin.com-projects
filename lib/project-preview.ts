const DEFAULT_PREVIEW_HOSTS = ['projectspreview.lite.space']

export type ProjectQueryOptions = {
  includeDrafts?: boolean
}

export function getProjectPreviewHosts(): string[] {
  const raw = process.env.PROJECT_PREVIEW_HOSTS?.trim()
  if (!raw) return DEFAULT_PREVIEW_HOSTS
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * True when the request Host is a project-preview hostname
 * (e.g. projectspreview.lite.space or localhost:3000 in local testing).
 */
export function isProjectPreviewHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false
  const host = hostHeader.split(',')[0]?.trim().toLowerCase()
  if (!host) return false

  return getProjectPreviewHosts().some((allowed) => {
    if (host === allowed) return true
    // Allow matching hostname without port when the allowlist has no port.
    if (!allowed.includes(':') && host.split(':')[0] === allowed) return true
    return false
  })
}

export async function isProjectPreviewRequest(): Promise<boolean> {
  const { headers } = await import('next/headers')
  const headerStore = await headers()
  return isProjectPreviewHost(
    headerStore.get('x-forwarded-host') || headerStore.get('host'),
  )
}
