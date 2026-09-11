'use client'

import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useDonation } from '@/contexts/DonationContext'
import { Project } from '@/types/project'
import { useProjectFiltering } from '@/hooks/useProjectFiltering'
import { BOUNTY_BG_COLORS, LITECOIN_FOUNDATION_PROJECT } from '@/utils/projectConstants'
import VerticalSocialIcons from '@/components/ui/VerticalSocialIcons'
import SectionWhite from '@/components/ui/SectionWhite'
import SectionBlue from '@/components/ui/SectionBlue'
import SectionStats from '@/components/ui/SectionStats'
import SectionMatchingDonations from '@/components/ui/SectionMatchingDonations'
import HeroSection from './HeroSection'
import ProjectsList from './ProjectsList'
import DevelopmentPortalSection from './DevelopmentPortalSection'

type ProjectsPageClientProps = {
  projects: Project[]
  includeHidden?: boolean
}

// Dynamically import PaymentModal to avoid SSR issues (react-modal)
const PaymentModal = dynamic(() => import('../payment/PaymentModal'), {
  ssr: false,
})

export default function ProjectsPageClient({
  projects,
  includeHidden = false,
}: ProjectsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dispatch } = useDonation()
  const { openSourceProjects, completedProjects, openBounties } = useProjectFiltering(
    projects,
    { includeHidden },
  )

  // Modal state (Foundation-only on this page)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined)

  const projectsRef = useRef<HTMLDivElement>(null)
  const bountiesRef = useRef<HTMLDivElement>(null)

  const openPaymentModal = useCallback((_project?: Project) => {
    const project = LITECOIN_FOUNDATION_PROJECT
    // Fresh donate session so a prior crypto address is not reused
    dispatch({ type: 'RESET_DONATION_STATE' })
    dispatch({
      type: 'SET_PROJECT_DETAILS',
      payload: {
        slug: project.slug,
        title: project.name,
        image: project.coverImage || '',
      },
    })
    router.push('/projects?modal=true')
  }, [dispatch, router])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    dispatch({ type: 'RESET_DONATION_STATE' })

    const params = new URLSearchParams(searchParams.toString())
    params.delete('modal')
    const newQuery = params.toString()
    const newUrl = newQuery ? `/projects?${newQuery}` : '/projects'
    router.push(newUrl, { scroll: false })
  }, [dispatch, router, searchParams])

  // Open/close modal based on query params (Foundation-only)
  useEffect(() => {
    const modal = searchParams.get('modal')
    if (modal === 'true') {
      const project = LITECOIN_FOUNDATION_PROJECT
      setSelectedProject(project)
      setModalOpen(true)

      dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          slug: project.slug,
          title: project.name,
          image: project.coverImage || '',
        },
      })
    } else {
      setModalOpen(false)
    }
  }, [dispatch, searchParams])

  const bgColors = useMemo(() => [...BOUNTY_BG_COLORS], [])

  return (
    <div className="w-full overflow-x-hidden">
      <VerticalSocialIcons />
      
      <HeroSection
        onDonateClick={() => openPaymentModal()}
        projectsRef={projectsRef}
        bountiesRef={bountiesRef}
      />

      <SectionWhite>
        <div className="py-2">
          <SectionStats />
        </div>
      </SectionWhite>

      <SectionBlue>
        <SectionMatchingDonations />
      </SectionBlue>

      <div ref={projectsRef}>
        <ProjectsList
          title="Open-Source Projects"
          projects={openSourceProjects}
          onProjectClick={openPaymentModal}
          emptyMessage="No open-source projects found."
          emptyDescription='Projects with status "Open" will appear here. Check the browser console for debugging information.'
        />
      </div>

      <div ref={bountiesRef}>
        <ProjectsList
          title="Completed Projects"
          projects={completedProjects}
          onProjectClick={openPaymentModal}
          emptyMessage="No completed projects found."
          emptyDescription='Projects with status "Completed", "Closed", "Bounty Completed", or "Bounty Closed" will appear here.'
        />
      </div>

      {openBounties.length > 0 && (
        <ProjectsList
          title="Open Bounties"
          projects={openBounties}
          onProjectClick={openPaymentModal}
          bgColors={bgColors}
        />
      )}

      <DevelopmentPortalSection />

      {/* Donation modal (Litecoin Foundation only) */}
      <PaymentModal
        isOpen={modalOpen}
        onRequestClose={closeModal}
        project={selectedProject}
      />
    </div>
  )
}

