import { kv } from '@/lib/kv'
import { createPayloadClient, fetchAllPages } from './client'
import type { PayloadPost } from './types'
import { getProjectBySlug } from './projects'
import type { Post } from '@/services/webflow/posts'
import type { ProjectQueryOptions } from '@/lib/project-preview'
import { toAppID, toPayloadID } from './id'

const CACHE_TTL = 259200 // 3 days in seconds

/**
 * Transform Payload Post to our Post type
 */
function transformPost(payloadPost: PayloadPost): Post {
  const projects = Array.isArray(payloadPost.projects)
    ? payloadPost.projects.map((p) => typeof p === 'number' ? toAppID(p) : toAppID(p.id))
    : []

  return {
    id: toAppID(payloadPost.id),
    isDraft: false,
    isArchived: false,
    fieldData: {
      'x-post-link': payloadPost.xPostLink,
      'youtube-link': payloadPost.youtubeLink,
      'reddit-link': payloadPost.redditLink,
      projects,
    },
  }
}

/**
 * Get posts for a specific project by its slug
 */
export async function getPostsByProjectSlug(
  slug: string,
  options?: ProjectQueryOptions,
): Promise<Post[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug, options)

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
 * Get posts for a specific project by its ID
 */
export async function getPostsByProjectId(projectId: string): Promise<Post[]> {
  const cacheKey = `payload:posts:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedPosts = await kv.get<Post[]>(cacheKey)
    if (cachedPosts) {
      return cachedPosts
    }
  } catch (error) {
    // KV not available, continue
  }

  const client = createPayloadClient()
  
  try {
    const payloadPosts = await fetchAllPages<PayloadPost>(
      client,
      '/posts',
      {
        where: {
          projects: {
            contains: toPayloadID(projectId),
          },
        },
      }
    )

    const posts = payloadPosts.map(transformPost)

    // Cache the posts
    try {
      await kv.set(cacheKey, posts, { ex: CACHE_TTL })
    } catch (error) {
      // KV not available, continue
    }

    return posts
  } catch (error: unknown) {
    console.error(`[getPostsByProjectId] Error fetching posts:`, error)
    return []
  }
}



