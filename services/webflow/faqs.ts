import { kv } from '@/lib/kv'
import { createWebflowClient, listCollectionItems } from './client'
import { getProjectBySlug } from './projects'

const CACHE_TTL = 259200 // 3 days in seconds

export interface FAQItem {
  id: string
  isDraft: boolean
  isArchived: boolean
  fieldData: {
    question?: string
    name?: string
    answer?: string
    project?: string
    order?: number
    category?: string
  }
}

/**
 * Get FAQs for a specific project by its slug.
 * @param slug - The slug of the project.
 * @returns An array of FAQItems related to the project or an empty array if the project is not found.
 */
export async function getFAQsByProjectSlug(
  slug: string,
  _options?: { includeDrafts?: boolean },
): Promise<FAQItem[]> {
  try {
    // Fetch the project using its slug to get the project ID
    const project = await getProjectBySlug(slug)

    if (!project) {
      console.warn(`[getFAQsByProjectSlug] No project found with slug "${slug}".`)
      return []
    }

    // Use the project ID to get FAQs
    return await getFAQsByProjectId(project.id)
  } catch (error: any) {
    console.error(`[getFAQsByProjectSlug] Error fetching FAQs for slug "${slug}":`, error)
    return []
  }
}

/**
 * Get FAQs for a specific project by its ID.
 * @param projectId - The ID of the project.
 * @returns An array of FAQItems related to the project.
 */
export async function getFAQsByProjectId(projectId: string): Promise<FAQItem[]> {
  const cacheKey = `faqs:project:${projectId}`
  
  try {
    // Try to get from cache first
    const cachedFAQs = await kv.get<FAQItem[]>(cacheKey)
    if (cachedFAQs) {
      return cachedFAQs
    }
  } catch (error) {
    // KV not available, continue
  }

  const apiToken = process.env.WEBFLOW_API_TOKEN
  const collectionId = process.env.WEBFLOW_COLLECTION_ID_FAQS

  if (!apiToken || !collectionId) {
    console.error('[getFAQsByProjectId] Webflow API credentials not configured')
    return []
  }

  const client = createWebflowClient(apiToken)
  const faqs = await listCollectionItems<FAQItem>(client, collectionId)

  // Filter FAQs by project ID and exclude drafts and archived items
  const projectFAQs = faqs
    .filter(
      (faq) =>
        faq.fieldData.project === projectId && !faq.isDraft && !faq.isArchived
    )
    .sort((a, b) => (a.fieldData.order || 0) - (b.fieldData.order || 0))

  // Cache the FAQs
  try {
    await kv.set(cacheKey, projectFAQs, { ex: CACHE_TTL })
  } catch (error) {
    // KV not available, continue
  }

  return projectFAQs
}

