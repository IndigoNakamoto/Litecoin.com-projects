import { kv } from '@/lib/kv'
import { createPayloadClient, fetchAllPages } from './client'
import type { PayloadFAQ } from './types'
import { getProjectBySlug } from './projects'
import type { FAQItem } from '@/services/webflow/faqs'
import type { ProjectQueryOptions } from '@/lib/project-preview'
import { toAppID, toPayloadID } from './id'
import { lexicalToHtml } from '@/utils/lexicalToHtml'

const CACHE_TTL = 259200 // 3 days in seconds

/**
 * Transform Payload FAQ to our FAQItem type
 */
function transformFAQ(payloadFAQ: PayloadFAQ): FAQItem {
  const projectId = typeof payloadFAQ.project === 'number'
    ? payloadFAQ.project
    : payloadFAQ.project.id

  return {
    id: toAppID(payloadFAQ.id),
    isDraft: false, // Payload doesn't have draft status in the same way
    isArchived: false,
    fieldData: {
      question: payloadFAQ.question,
      answer: lexicalToHtml(payloadFAQ.answer), // Rich text content converted to HTML
      project: toAppID(projectId),
      order: payloadFAQ.order,
      category: payloadFAQ.category,
    },
  }
}

/**
 * Get FAQs for a specific project by its slug
 */
export async function getFAQsByProjectSlug(
  slug: string,
  options?: ProjectQueryOptions,
): Promise<FAQItem[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug, options)

    if (!project) {
      console.warn(`[getFAQsByProjectSlug] No project found with slug "${slug}".`)
      return []
    }

    // Use the project ID to get FAQs
    return await getFAQsByProjectId(project.id)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[getFAQsByProjectSlug] Error fetching FAQs for slug "${slug}":`, errorMessage)
    return []
  }
}

/**
 * Get FAQs for a specific project by its ID
 */
export async function getFAQsByProjectId(projectId: string): Promise<FAQItem[]> {
  const cacheKey = `payload:faqs:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedFAQs = await kv.get<FAQItem[]>(cacheKey)
    if (cachedFAQs) {
      return cachedFAQs
    }
  } catch (error) {
    // KV not available, continue
  }

  const client = createPayloadClient()
  
  try {
    const payloadFAQs = await fetchAllPages<PayloadFAQ>(
      client,
      '/faqs',
      {
        where: {
          project: {
            equals: toPayloadID(projectId),
          },
        },
      }
    )

    // Sort by order
    payloadFAQs.sort((a, b) => (a.order || 0) - (b.order || 0))

    const faqs = payloadFAQs.map(transformFAQ)

    // Cache the FAQs
    try {
      await kv.set(cacheKey, faqs, { ex: CACHE_TTL })
    } catch (error) {
      // KV not available, continue
    }

    return faqs
  } catch (error: unknown) {
    console.error(`[getFAQsByProjectId] Error fetching FAQs:`, error)
    return []
  }
}



