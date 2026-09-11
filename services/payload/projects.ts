import { kv } from '@/lib/kv'
import { createPayloadClient, fetchAllPages, resolvePayloadAssetUrl } from './client'
import type { PayloadProject, PayloadContributor } from './types'
import type { Project, Contributor } from '@/types/project'
import type { ProjectQueryOptions } from '@/lib/project-preview'
import { getContributorsByIds } from './contributors'
import { toAppID } from './id'
import { lexicalToHtml } from '@/utils/lexicalToHtml'

const CACHE_TTL = 259200 // 3 days in seconds
const PREVIEW_CACHE_TTL = 60 // seconds — drafts should appear quickly

/**
 * Transform Payload contributor to our Contributor type
 */
function transformContributor(payloadContributor: PayloadContributor): Contributor {
  const profilePicture = payloadContributor.profilePicture
  let avatarUrl: string | undefined
  
  // Handle profilePicture - it can be a number (ID), an object with url, or undefined
  if (typeof profilePicture === 'object' && profilePicture && 'url' in profilePicture) {
    avatarUrl = resolvePayloadAssetUrl(profilePicture.url)
  } else if (typeof profilePicture === 'number') {
    // If it's just an ID, we can't resolve it here - would need another API call
    // For now, set to undefined - the image won't load but at least won't break
    console.warn(`[transformContributor] Contributor ${payloadContributor.id} has profilePicture as ID (${profilePicture}), not populated. Need depth > 1 for nested media.`)
    avatarUrl = undefined
  }

  return {
    id: toAppID(payloadContributor.id),
    name: payloadContributor.name,
    slug: payloadContributor.slug,
    avatar: avatarUrl,
    twitterLink: payloadContributor.twitterLink,
    discordLink: payloadContributor.discordLink,
    githubLink: payloadContributor.githubLink,
    youtubeLink: payloadContributor.youtubeLink,
    linkedinLink: payloadContributor.linkedinLink,
    email: payloadContributor.email,
  }
}

/**
 * Transform Payload project to our Project type
 */
async function transformProject(
  payloadProject: PayloadProject,
  resolveContributors: boolean = true
): Promise<Project> {
  const coverImage = payloadProject.coverImage
  const coverImageUrl = resolvePayloadAssetUrl(
    typeof coverImage === 'object' && coverImage ? coverImage.url : undefined
  )

  let bitcoinContributors: Contributor[] | undefined
  let litecoinContributors: Contributor[] | undefined
  let advocates: Contributor[] | undefined

  if (resolveContributors) {
    // Resolve contributor relationships
    const bitcoinIds = Array.isArray(payloadProject.bitcoinContributors)
      ? payloadProject.bitcoinContributors
          .filter((c): c is number => typeof c === 'number')
          .map(toAppID)
      : []
    
    const litecoinIds = Array.isArray(payloadProject.litecoinContributors)
      ? payloadProject.litecoinContributors
          .filter((c): c is number => typeof c === 'number')
          .map(toAppID)
      : []
    
    const advocateIds = Array.isArray(payloadProject.advocates)
      ? payloadProject.advocates
          .filter((c): c is number => typeof c === 'number')
          .map(toAppID)
      : []

    // If contributors are already populated, use them directly
    if (payloadProject.bitcoinContributors && 
        payloadProject.bitcoinContributors.length > 0 &&
        typeof payloadProject.bitcoinContributors[0] !== 'number') {
      bitcoinContributors = (payloadProject.bitcoinContributors as PayloadContributor[])
        .map(transformContributor)
    } else if (bitcoinIds.length > 0) {
      bitcoinContributors = await getContributorsByIds(bitcoinIds)
    }

    if (payloadProject.litecoinContributors && 
        payloadProject.litecoinContributors.length > 0 &&
        typeof payloadProject.litecoinContributors[0] !== 'number') {
      litecoinContributors = (payloadProject.litecoinContributors as PayloadContributor[])
        .map(transformContributor)
    } else if (litecoinIds.length > 0) {
      litecoinContributors = await getContributorsByIds(litecoinIds)
    }

    if (payloadProject.advocates && 
        payloadProject.advocates.length > 0 &&
        typeof payloadProject.advocates[0] !== 'number') {
      advocates = (payloadProject.advocates as PayloadContributor[])
        .map(transformContributor)
    } else if (advocateIds.length > 0) {
      advocates = await getContributorsByIds(advocateIds)
    }
  }

  /**
   * Map Payload CMS status to Webflow-compatible status format
   * Payload uses: 'active' | 'completed' | 'paused' | 'archived'
   * Webflow uses: 'Open' | 'Completed' | 'Closed' | 'Bounty Open' | 'Bounty Closed' | 'Bounty Completed'
   */
  const mapPayloadStatusToWebflow = (payloadStatus: string): string => {
    const statusMap: Record<string, string> = {
      'active': 'Open',
      'funded': 'Funding Target Reached',
      'completed': 'Completed',
      'paused': 'Closed',
      'archived': 'Closed',
    }
    const normalizedStatus = payloadStatus.toLowerCase().trim()
    const mappedStatus = statusMap[normalizedStatus] || payloadStatus
    
    // Debug logging for status transformation (only in development)
    if (process.env.NODE_ENV === 'development') {
      if (normalizedStatus === 'completed' || normalizedStatus === 'active') {
        console.log(`[transformProject] Status mapping: "${payloadStatus}" → "${mappedStatus}" for project: ${payloadProject.slug}`)
      }
    }
    
    return mappedStatus
  }

  return {
    id: toAppID(payloadProject.id),
    name: payloadProject.name,
    slug: payloadProject.slug,
    summary: payloadProject.summary,
    content: lexicalToHtml(payloadProject.content),
    coverImage: coverImageUrl,
    status: mapPayloadStatusToWebflow(payloadProject.status),
    projectType: payloadProject.projectType,
    hidden: payloadProject.hidden,
    recurring: payloadProject.recurring,
    totalPaid: payloadProject.totalPaid,
    serviceFeesCollected: payloadProject.serviceFeesCollected,
    litecoinRaised: payloadProject.litecoinRaised ?? 0,
    litecoinPaid: payloadProject.litecoinPaid ?? 0,
    donationTarget:
      payloadProject.donationTarget != null
        ? Number(payloadProject.donationTarget)
        : undefined,
    website: payloadProject.website,
    github: payloadProject.github,
    twitter: payloadProject.twitter,
    discord: payloadProject.discord,
    telegram: payloadProject.telegram,
    reddit: payloadProject.reddit,
    facebook: payloadProject.facebook,
    lastPublished: payloadProject.updatedAt,
    lastUpdated: payloadProject.updatedAt,
    createdOn: payloadProject.createdAt,
    bitcoinContributors: bitcoinContributors && bitcoinContributors.length > 0 
      ? bitcoinContributors 
      : undefined,
    litecoinContributors: litecoinContributors && litecoinContributors.length > 0 
      ? litecoinContributors 
      : undefined,
    advocates: advocates && advocates.length > 0 
      ? advocates 
      : undefined,
    _status: payloadProject._status ?? undefined,
  }
}

/**
 * Get projects from Payload CMS.
 * Production: published + not hidden, unauthenticated.
 * Preview (`includeDrafts`): latest draft or published, including hidden, authenticated.
 */
export async function getAllPublishedProjects(
  options: ProjectQueryOptions = {},
): Promise<Project[]> {
  const includeDrafts = options.includeDrafts === true
  if (includeDrafts && !process.env.PAYLOAD_API_TOKEN) {
    console.warn(
      '[payload:getAllPublishedProjects] includeDrafts=true but PAYLOAD_API_TOKEN is unset; drafts will not be returned',
    )
  }
  console.log(
    `[payload:getAllPublishedProjects] Fetching projects from Payload CMS (includeDrafts=${includeDrafts})`,
  )
  const client = createPayloadClient({ authenticate: includeDrafts })
  
  const cacheKey = includeDrafts ? 'payload:projects:preview' : 'payload:projects:published'
  const cacheTtl = includeDrafts ? PREVIEW_CACHE_TTL : CACHE_TTL
  let cached: Project[] | null = null
  
  // Try to get from cache (skip if FORCE_REFRESH_PAYLOAD is set)
  const forceRefresh = process.env.FORCE_REFRESH_PAYLOAD === 'true'
  if (!forceRefresh) {
    try {
      cached = await kv.get<Project[]>(cacheKey)
      if (cached) {
        // If any cached slugs look like Webflow IDs (24-hex), refresh. This happens if
        // an older migration incorrectly stored `slug` as the Webflow item ID.
        const hasLegacySlug = cached.some((p) => /^[0-9a-f]{24}$/i.test(p.slug))
        const hasRelativeMedia = cached.some((p) => typeof p.coverImage === 'string' && p.coverImage.startsWith('/'))
        if (!hasLegacySlug && !hasRelativeMedia) {
          console.log('[payload:getAllPublishedProjects] Returning cached data')
          return cached
        } else {
          console.warn('[payload:getAllPublishedProjects] Detected legacy cache (slug/media); refreshing')
        }
      }
    } catch (error) {
      // KV not available, continue
      console.warn('KV cache unavailable, fetching directly from Payload')
    }
  } else {
    console.log('[payload:getAllPublishedProjects] FORCE_REFRESH_PAYLOAD=true, skipping cache')
    // Clear the cache when forcing refresh
    try {
      await kv.del(cacheKey)
      console.log('[payload:getAllPublishedProjects] Cleared cache')
    } catch (error) {
      // KV not available, continue
    }
  }

  // Fetch all projects with contributors populated
  const payloadProjects = await fetchAllPages<PayloadProject>(
    client,
    '/projects',
    includeDrafts
      ? {
          draft: true,
          depth: 2,
        }
      : {
          where: {
            hidden: {
              equals: false,
            },
          },
          depth: 2,
        },
  )

  // Transform to our Project type
  const projects = await Promise.all(
    payloadProjects.map((p) => transformProject(p, true))
  )

  console.log(`[payload:getAllPublishedProjects] Fetched ${projects.length} projects from Payload CMS`)
  
  // Debug: Log projects with completed status
  const completedProjects = projects.filter(p => 
    p.status === 'Completed' || p.status?.toLowerCase().includes('completed')
  )
  if (completedProjects.length > 0) {
    console.log(`[payload:getAllPublishedProjects] Found ${completedProjects.length} completed project(s):`, 
      completedProjects.map(p => ({ name: p.name, slug: p.slug, status: p.status }))
    )
  } else {
    console.warn('[payload:getAllPublishedProjects] No projects with "Completed" status found. All project statuses:', 
      projects.map(p => ({ name: p.name, slug: p.slug, status: p.status }))
    )
  }

  // Cache the results
  try {
    await kv.set(cacheKey, projects, { ex: cacheTtl })
    console.log('[payload:getAllPublishedProjects] Cached projects')
  } catch (error) {
    // KV not available, continue
    console.warn('KV cache unavailable, skipping cache write')
  }

  return projects
}

/**
 * Get a project by slug from Payload CMS
 */
export async function getProjectBySlug(
  slug: string,
  options: ProjectQueryOptions = {},
): Promise<Project | null> {
  const includeDrafts = options.includeDrafts === true
  if (includeDrafts && !process.env.PAYLOAD_API_TOKEN) {
    console.warn(
      `[getProjectBySlug] includeDrafts=true but PAYLOAD_API_TOKEN is unset; draft "${slug}" will not be returned`,
    )
  }
  const client = createPayloadClient({ authenticate: includeDrafts })
  
  // Try to get from cache first (skip if FORCE_REFRESH_PAYLOAD is set)
  const cacheKey = includeDrafts ? `payload:project:preview:${slug}` : `payload:project:${slug}`
  const cacheTtl = includeDrafts ? PREVIEW_CACHE_TTL : CACHE_TTL
  const forceRefresh = process.env.FORCE_REFRESH_PAYLOAD === 'true'
  
  if (!forceRefresh) {
    try {
      const cached = await kv.get<Project>(cacheKey)
      if (cached) {
        return cached
      }
    } catch (error) {
      // KV not available, continue
    }
  } else {
    console.log(`[getProjectBySlug] FORCE_REFRESH_PAYLOAD=true, skipping cache for project "${slug}"`)
    // Clear the cache when forcing refresh
    try {
      await kv.del(cacheKey)
      console.log(`[getProjectBySlug] Cleared cache for project "${slug}"`)
    } catch (error) {
      // KV not available, continue
    }
  }

  try {
    // Fetch project by slug with contributors populated
    const response = await client.get('/projects', {
      params: includeDrafts
        ? {
            where: {
              slug: {
                equals: slug,
              },
            },
            draft: true,
            depth: 2,
            limit: 1,
          }
        : {
            where: {
              slug: {
                equals: slug,
              },
              hidden: {
                equals: false,
              },
            },
            depth: 2,
            limit: 1,
          },
    })

    const { docs } = response.data

    if (!docs || docs.length === 0) {
      console.warn(`[getProjectBySlug] Project "${slug}" not found`)
      return null
    }

    const payloadProject = docs[0] as PayloadProject
    const project = await transformProject(payloadProject, true)

    // Cache the result (unless forcing refresh, in which case we already cleared it)
    if (!forceRefresh) {
      try {
        await kv.set(cacheKey, project, { ex: cacheTtl })
      } catch (error) {
        // KV not available, continue
      }
    }

    return project
  } catch (error: unknown) {
    console.error(`[getProjectBySlug] Error fetching project "${slug}":`, error)
    if (error instanceof Error) {
      console.error(`[getProjectBySlug] Error details:`, error.message, error.stack)
    }
    throw error
  }
}

/**
 * Get project summaries (lightweight version)
 */
export async function getProjectSummaries(): Promise<Array<{
  id: string
  name: string
  slug: string
  summary: string
  coverImage?: string
  status: string
  projectType?: string
  totalPaid: number
}>> {
  const projects = await getAllPublishedProjects()
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    summary: project.summary,
    coverImage: project.coverImage,
    status: project.status,
    projectType: project.projectType,
    totalPaid: project.totalPaid,
  }))
}



