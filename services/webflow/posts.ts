import { kv } from '@/lib/kv'
import { createWebflowClient, listCollectionItems } from './client'
import { getProjectBySlug } from './projects'

const CACHE_TTL = 259200 // 3 days in seconds

export interface Post {
  id: string
  isDraft: boolean
  isArchived: boolean
  fieldData: {
    'x-post-link'?: string
    'youtube-link'?: string
    'reddit-link'?: string
    projects?: string[]
  }
}

/**
 * Get posts for a specific project by its slug.
 * @param slug - The slug of the project.
 * @returns An array of Posts related to the project or an empty array if the project is not found.
 */
export async function getPostsByProjectSlug(
  slug: string,
  _options?: { includeDrafts?: boolean },
): Promise<Post[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug)

    if (!project) {
      console.warn(`[getPostsByProjectSlug] No project found with slug "${slug}".`)
      return []
    }

    // Use the project ID to get posts
    return await getPostsByProjectId(project.id)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[getPostsByProjectSlug] Error fetching posts for slug "${slug}":`, errorMessage)
    return []
  }
}

/**
 * Get posts for a specific project by its ID.
 * @param projectId - The ID of the project.
 * @returns An array of Posts related to the project.
 */
export async function getPostsByProjectId(projectId: string): Promise<Post[]> {
  const cacheKey = `posts:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedPosts = await kv.get<Post[]>(cacheKey)
    if (cachedPosts) {
      return cachedPosts
    }
  } catch (error) {
    // KV not available, continue
  }

  const apiToken = process.env.WEBFLOW_API_TOKEN
  const collectionId = process.env.WEBFLOW_COLLECTION_ID_POSTS

  if (!apiToken || !collectionId) {
    console.error('[getPostsByProjectId] Webflow API credentials not configured')
    return []
  }

  const client = createWebflowClient(apiToken)
  
  try {
    const allPosts = await listCollectionItems<Post>(client, collectionId)

    // If rate limited, listCollectionItems returns empty array, so we'll return empty array
    if (allPosts.length === 0) {
      console.warn(`[getPostsByProjectId] No posts returned (may be rate limited), trying cache...`)
      // Try to get from cache as fallback
      try {
        const cached = await kv.get<Post[]>(cacheKey)
        if (cached) {
          return cached
        }
      } catch (_cacheError) {
        // Cache not available
      }
      return []
    }

    // Filter posts by project ID and exclude drafts and archived items
    const projectPosts = allPosts.filter((post) => {
      const projects = post.fieldData.projects
      return (
        Array.isArray(projects) &&
        projects.includes(projectId) &&
        !post.isDraft &&
        !post.isArchived
      )
    })

    // Cache the posts
    try {
      await kv.set(cacheKey, projectPosts, { ex: CACHE_TTL })
    } catch (_error) {
      // KV not available, continue
    }

    return projectPosts
  } catch (error: unknown) {
    // If we get an error (other than rate limit which is handled in listCollectionItems),
    // try to use cached data if available
    const axiosError = error as { response?: { status?: number }; message?: string }
    console.warn(
      `[getPostsByProjectId] Error fetching posts, trying cached data...`,
      axiosError.response?.status || axiosError.message
    )
    try {
      const cached = await kv.get<Post[]>(cacheKey)
      if (cached) {
        return cached
      }
    } catch (_cacheError) {
      // Cache not available
    }
    
    // Return empty array to allow graceful degradation
    console.warn(`[getPostsByProjectId] No cached posts available, returning empty array`)
    return []
  }
}

