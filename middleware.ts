import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isProjectPreviewHost } from '@/lib/project-preview'

export function middleware(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!isProjectPreviewHost(host)) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|static/).*)'],
}
