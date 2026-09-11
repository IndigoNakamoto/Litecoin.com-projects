import { kv } from '@/lib/kv'
import { createPayloadClient, fetchAllPages } from './client'
import type { PayloadUpdate } from './types'
import { getProjectBySlug } from './projects'
import type { Update } from '@/services/webflow/updates'
import type { ProjectQueryOptions } from '@/lib/project-preview'
import { toAppID, toPayloadID } from './id'
import { lexicalToHtml } from '@/utils/lexicalToHtml'

const CACHE_TTL = 259200 // 3 days in seconds

/**
 * Transform Payload Update to our Update type
 */
function transformUpdate(payloadUpdate: PayloadUpdate): Update {
  const projectId = typeof payloadUpdate.project === 'number'
    ? payloadUpdate.project
    : payloadUpdate.project.id

  return {
    id: toAppID(payloadUpdate.id),
    isDraft: false,
    isArchived: false,
    fieldData: {
      name: payloadUpdate.title,
      title: payloadUpdate.title,
      summary: payloadUpdate.summary,
      content: lexicalToHtml(payloadUpdate.content), // Rich text content converted to HTML
      project: toAppID(projectId),
      createdOn: payloadUpdate.createdAt,
      date: payloadUpdate.date,
      authorTwitterHandle: payloadUpdate.authorTwitterHandle,
      tags: payloadUpdate.tags?.map((t) => t.tag),
    },
  }
}

/**
 * Get updates for a specific project by its slug
 */
export async function getUpdatesByProjectSlug(
  slug: string,
  options?: ProjectQueryOptions,
): Promise<Update[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug, options)

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
 * Get updates for a specific project by its ID
 */
export async function getUpdatesByProjectId(projectId: string): Promise<Update[]> {
  const cacheKey = `payload:updates:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedUpdates = await kv.get<Update[]>(cacheKey)
    if (cachedUpdates) {
      return cachedUpdates
    }
  } catch (error) {
    // KV not available, continue
  }

  const client = createPayloadClient()
  
  try {
    const payloadUpdates = await fetchAllPages<PayloadUpdate>(
      client,
      '/updates',
      {
        where: {
          project: {
            equals: toPayloadID(projectId),
          },
        },
        sort: '-date', // Sort by date descending
      }
    )

    const updates = payloadUpdates.map(transformUpdate)

    // Cache the updates
    try {
      await kv.set(cacheKey, updates, { ex: CACHE_TTL })
    } catch (error) {
      // KV not available, continue
    }

    return updates
  } catch (error: unknown) {
    console.error(`[getUpdatesByProjectId] Error fetching updates:`, error)
    return []
  }
}



