import { getAllPublishedProjects } from '@/services/cms/projects'
import ProjectsPageClient from '@/components/projects/ProjectsPageClient'
import { Suspense } from 'react'
import { isProjectPreviewRequest } from '@/lib/project-preview'
import type { Metadata } from 'next'

// Force dynamic rendering to avoid stale cache for project statuses
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const isPreview = await isProjectPreviewRequest()
  return {
    title: isPreview ? 'Projects (preview)' : 'Projects',
    robots: isPreview ? { index: false, follow: false } : undefined,
  }
}

export default async function ProjectsPage() {
  const includeDrafts = await isProjectPreviewRequest()
  const projects = await getAllPublishedProjects({ includeDrafts })

  // ProjectsPageClient uses useSearchParams(), which requires a Suspense boundary in Next.js.
  return (
    <Suspense fallback={null}>
      <ProjectsPageClient projects={projects} includeHidden={includeDrafts} />
    </Suspense>
  )
}
