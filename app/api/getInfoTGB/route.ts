import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { databaseApiHeaders, getDatabaseApiUrl } from '@/lib/database-api'

type SuccessResponse = {
  funded_txo_sum: number
  tx_count: number
  supporters: string[]
  donatedCreatedTime: {
    valueAtDonationTimeUSD: number
    createdTime: string
  }[]
}

type ErrorResponse = {
  message: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json(
      { message: 'Slug is required' },
      { status: 400 }
    )
  }

  try {
    // Check cache first
    const cacheKey = `tgb-info-${slug}`
    try {
      const cachedData = await kv.get<SuccessResponse>(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData)
      }
    } catch {
      // KV might not be available, continue without cache
    }

    // Call database API
    const apiUrl = getDatabaseApiUrl()
    const response = await fetch(`${apiUrl}/api/projects/${encodeURIComponent(slug)}/stats`, { headers: databaseApiHeaders(), signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      if (response.status === 404) {
        // No rows yet is a valid zero-stats project (drafts, new goals).
        return NextResponse.json({
          funded_txo_sum: 0,
          tx_count: 0,
          supporters: [],
          donatedCreatedTime: [],
        })
      }
      const errorText = await response.text()
      throw new Error(`API returned ${response.status}: ${errorText}`)
    }

    const responseData = await response.json() as SuccessResponse

    // Cache the result
    try {
      await kv.set(cacheKey, responseData, { ex: 900 }) // Cache for 15 minutes
    } catch {
      // KV might not be available, continue without caching
    }

    return NextResponse.json(responseData)
  } catch (err) {
    console.error('[getInfoTGB] Error fetching donation info:', err)
    return NextResponse.json(
      { message: (err as Error).message },
      { status: 500 }
    )
  }
}

