/**
 * Payload CMS API response types
 */

export interface PayloadProject {
  id: number
  name: string
  slug: string
  summary: string
  content?: unknown
  coverImage?: number | {
    id: number
    url: string
    alt?: string
  }
  status: 'active' | 'funded' | 'completed' | 'paused' | 'archived'
  projectType?: 'open-source' | 'research' | 'education' | 'infrastructure'
  hidden: boolean
  recurring: boolean
  totalPaid: number
  serviceFeesCollected: number
  litecoinRaised?: number
  litecoinPaid?: number
  donationTarget?: number
  website?: string
  github?: string
  twitter?: string
  discord?: string
  telegram?: string
  reddit?: string
  facebook?: string
  bitcoinContributors?: number[] | PayloadContributor[]
  litecoinContributors?: number[] | PayloadContributor[]
  advocates?: number[] | PayloadContributor[]
  hashtags?: Array<{ tag: string }>
  createdAt: string
  updatedAt: string
  _status?: 'draft' | 'published' | null
}

export interface PayloadContributor {
  id: number
  name: string
  slug: string
  profilePicture?: number | {
    id: number
    url: string
    alt?: string
  }
  twitterLink?: string
  discordLink?: string
  githubLink?: string
  youtubeLink?: string
  linkedinLink?: string
  email?: string
  createdAt: string
  updatedAt: string
}

export interface PayloadFAQ {
  id: number
  question: string
  answer: unknown
  project: number | PayloadProject
  order?: number
  category?: string
  createdAt: string
  updatedAt: string
}

export interface PayloadPost {
  id: number
  xPostLink?: string
  youtubeLink?: string
  redditLink?: string
  projects?: number[] | PayloadProject[]
  createdAt: string
  updatedAt: string
}

export interface PayloadUpdate {
  id: number
  title: string
  summary?: string
  content?: unknown
  project: number | PayloadProject
  date: string
  authorTwitterHandle?: string
  tags?: Array<{ tag: string }>
  createdAt: string
  updatedAt: string
}

export interface PayloadResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page?: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage?: number | null
  nextPage?: number | null
}



