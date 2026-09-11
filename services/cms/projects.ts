import { usePayloadCMS } from './config'
import type { ProjectQueryOptions } from '@/lib/project-preview'

import * as webflow from '@/services/webflow/projects'
import * as payload from '@/services/payload/projects'

export type { ProjectQueryOptions } from '@/lib/project-preview'

export async function getAllPublishedProjects(options?: ProjectQueryOptions) {
  const usePayload = usePayloadCMS()
  console.log('[cms/projects] getAllPublishedProjects - USE_PAYLOAD_CMS:', usePayload)
  return usePayload
    ? payload.getAllPublishedProjects(options)
    : webflow.getAllPublishedProjects()
}

export async function getProjectBySlug(slug: string, options?: ProjectQueryOptions) {
  return usePayloadCMS()
    ? payload.getProjectBySlug(slug, options)
    : webflow.getProjectBySlug(slug)
}

export async function getProjectSummaries(...args: Parameters<typeof webflow.getProjectSummaries>) {
  return usePayloadCMS()
    ? payload.getProjectSummaries(...args)
    : webflow.getProjectSummaries(...args)
}
