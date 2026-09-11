import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { createPayloadClient, fetchAllPages } from '@/services/payload/client'
import { requireCronAuth } from '@/lib/cron-auth'

/**
 * Clear Payload CMS cache
 * POST /api/clear-payload-cache
 * Requires Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireCronAuth(request)
  if (unauthorized) return unauthorized

  try {
    const clearedKeys: string[] = []

    // Clear main cache keys
    const mainCacheKeys = [
      'payload:projects:published',
      'payload:projects:preview',
      'payload:contributors:active',
    ]

    for (const key of mainCacheKeys) {
      try {
        const deleted = await kv.del(key)
        if (deleted > 0) {
          clearedKeys.push(key)
          console.log(`[clear-payload-cache] Cleared: ${key}`)
        }
      } catch (err) {
        console.warn(`[clear-payload-cache] Error clearing ${key}:`, err)
      }
    }

    // Fetch all projects from Payload to get their slugs and clear individual project caches
    try {
      const client = createPayloadClient({ authenticate: true })
      const fullProjects = await fetchAllPages<{ id: number; slug: string }>(
        client,
        '/projects',
        {
          draft: true,
          limit: 100,
        }
      )

      for (const project of fullProjects) {
        // Clear project by slug cache
        const projectCacheKeys = [
          `payload:project:${project.slug}`,
          `payload:project:preview:${project.slug}`,
        ]
        for (const projectCacheKey of projectCacheKeys) {
          try {
            const deleted = await kv.del(projectCacheKey)
            if (deleted > 0) {
              clearedKeys.push(projectCacheKey)
            }
          } catch (err) {
            // Key might not exist, continue
          }
        }

        // Clear posts cache for this project
        const postsCacheKey = `payload:posts:project:${project.id}`
        try {
          const deleted = await kv.del(postsCacheKey)
          if (deleted > 0) {
            clearedKeys.push(postsCacheKey)
          }
        } catch (err) {
          // Key might not exist, continue
        }

        // Clear FAQs cache for this project
        const faqsCacheKey = `payload:faqs:project:${project.id}`
        try {
          const deleted = await kv.del(faqsCacheKey)
          if (deleted > 0) {
            clearedKeys.push(faqsCacheKey)
          }
        } catch (err) {
          // Key might not exist, continue
        }

        // Clear updates cache for this project
        const updatesCacheKey = `payload:updates:project:${project.id}`
        try {
          const deleted = await kv.del(updatesCacheKey)
          if (deleted > 0) {
            clearedKeys.push(updatesCacheKey)
          }
        } catch (err) {
          // Key might not exist, continue
        }
      }

      console.log(`[clear-payload-cache] Processed ${fullProjects.length} projects for cache clearing`)
    } catch (error) {
      console.warn('[clear-payload-cache] Error fetching projects to clear individual caches:', error)
      // Continue even if we can't fetch projects - we've already cleared the main cache
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedKeys.length} cache keys`,
      clearedKeys,
    })
  } catch (error) {
    console.error('[clear-payload-cache] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for convenience (same as POST)
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
