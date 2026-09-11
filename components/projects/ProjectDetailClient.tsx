'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ProjectHeader from './ProjectHeader'
import ProjectMenu from './ProjectMenu'
import MenuSections from './MenuSections'
import AsideSection from './AsideSection'
import { Project } from '@/types/project'
import { AddressStats, BountyStatus } from '@/utils/types'
import { defaultAddressStats } from '@/utils/defaultValues'
import { determineBountyStatus } from '@/utils/statusHelpers'
import { useDonation } from '@/contexts/DonationContext'
import { fetchGetJSON } from '@/utils/api-helpers'

// Dynamically import PaymentModal to avoid SSR issues
const PaymentModal = dynamic(() => import('../payment/PaymentModal'), {
  ssr: false,
})

// Dynamically import ThankYouModal to avoid SSR issues
const ThankYouModal = dynamic(() => import('../payment/ThankYouModal'), {
  ssr: false,
})

type ProjectDetailClientProps = {
  project: Project
  addressStats?: AddressStats
  faqs?: any[]
  updates?: any[]
  posts?: any[]
}

export default function ProjectDetailClient({
  project,
  addressStats: initialAddressStats = defaultAddressStats,
  faqs = [],
  updates = [],
  posts = [],
}: ProjectDetailClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { dispatch } = useDonation()
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>('Info')
  const [selectedUpdateId, setSelectedUpdateId] = useState<number | null>(null)
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [isThankYouModalOpen, setThankYouModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | undefined>()

  // State Variables for donation data
  const [addressStats, setAddressStats] = useState<AddressStats | undefined>(initialAddressStats)
  const [matchingDonors, setMatchingDonors] = useState<unknown[] | undefined>(undefined)
  const [matchingTotal, setMatchingTotal] = useState(0)
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [monthlyDonorCount, setMonthlyDonorCount] = useState(0)
  const [timeLeftInMonth, setTimeLeftInMonth] = useState(0)

  // Handle URL query parameters for updates
  useEffect(() => {
    const updateId = searchParams.get('updateId')
    
    if (updateId) {
      const numericId = parseInt(updateId, 10)
      if (!isNaN(numericId)) {
        setSelectedUpdateId(numericId)
        // Switch to updates tab if there are updates
        if (updates.length > 0) {
          setSelectedMenuItem('updates')
        }
      }
    }
  }, [searchParams, updates.length])

  // Scroll to selected update when it becomes available
  useEffect(() => {
    if (selectedUpdateId && selectedMenuItem === 'updates') {
      // Use setTimeout to ensure DOM is rendered
      setTimeout(() => {
        const element = document.getElementById(`update-${selectedUpdateId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [selectedUpdateId, selectedMenuItem, updates])

  const formatUSD = (value: any) => {
    const num = Number(value)
    if (isNaN(num) || value === '' || value === null) {
      return '0.00'
    }
    if (num === 0) {
      return '0.00'
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatLits = (value: number) => {
    return value.toFixed(2)
  }

  const bountyStatus = determineBountyStatus(project.status)

  // Extract project fields (with fallbacks for fields that might not exist in Project type)
  type ProjectWithExtendedFields = Project & {
    isMatching?: boolean
    isBitcoinOlympics2024?: boolean
    matchingMultiplier?: number
    recurringAmountGoal?: number
  }
  const extendedProject = project as ProjectWithExtendedFields
  const isMatching = extendedProject.isMatching ?? false
  const isBitcoinOlympics2024 = extendedProject.isBitcoinOlympics2024 ?? false
  const matchingMultiplier = extendedProject.matchingMultiplier
  const recurringAmountGoal = extendedProject.recurringAmountGoal
  const litecoinRaised = project.litecoinRaised ?? 0
  const litecoinPaid = project.litecoinPaid ?? 0
  const parsedDonationTarget = Number(project.donationTarget)
  const donationTarget =
    Number.isFinite(parsedDonationTarget) && parsedDonationTarget > 0
      ? parsedDonationTarget
      : undefined
  const fundingProgressReady =
    addressStats !== undefined && matchingDonors !== undefined

  // Fetch donations, contributors, and supporters
  useEffect(() => {
    const fetchData = async () => {
      try {
        setAddressStats(undefined)
        const statsResponse = await fetchGetJSON(`/api/getInfoTGB?slug=${project.slug}`)
        
        // Type for API response which includes donatedCreatedTime
        type StatsResponse = AddressStats & {
          donatedCreatedTime?: Array<{
            valueAtDonationTimeUSD: number
            createdTime: string
            amount?: number
          }>
        }
        const stats = statsResponse as StatsResponse
        
        // Set addressStats with only the AddressStats fields
        // 404 / "no donations" returns { message } with no totals — treat as zeros
        // so a goal of $100k and $0 raised shows 0%, not NaN%.
        const txCount = Number(stats?.tx_count)
        const fundedSum = Number(stats?.funded_txo_sum)
        const safeTxCount = Number.isFinite(txCount) ? txCount : 0
        const safeFundedSum = Number.isFinite(fundedSum) ? fundedSum : 0
        setAddressStats({
          tx_count: safeTxCount,
          funded_txo_sum: safeFundedSum,
          supporters: Array.isArray(stats?.supporters) ? stats.supporters : [],
        })

        try {
          const matchingDonorsData = await fetchGetJSON(
            `/api/matching-donors-by-project?slug=${project.slug}`
          )
          // Ensure we set an array, even if API returns error or null
          if (Array.isArray(matchingDonorsData)) {
            setMatchingDonors(matchingDonorsData)
          } else if (matchingDonorsData && typeof matchingDonorsData === 'object' && 'error' in matchingDonorsData) {
            // API returned an error object
            console.warn('Matching donors API returned error:', matchingDonorsData.error)
            setMatchingDonors([])
          } else {
            // Unknown format, default to empty array
            setMatchingDonors([])
          }
        } catch (error) {
          console.error('Error fetching matching donors:', error)
          setMatchingDonors([])
        }

        // Matching goal calculation
        if (
          isMatching &&
          typeof matchingMultiplier === 'number' &&
          isBitcoinOlympics2024
        ) {
          const matchingTotalCalc =
            safeFundedSum * matchingMultiplier - safeFundedSum
          setMatchingTotal(Number.isFinite(matchingTotalCalc) ? matchingTotalCalc : 0)
        }

        // Monthly goal calculation
        if (project.recurring && recurringAmountGoal) {
          const currentDate = new Date()
          const startOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          )
          const endOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
          )

          const donatedCreatedTime = stats.donatedCreatedTime || []
          const monthlyDonations = donatedCreatedTime.filter(
            (donation) => {
              const donationDate = new Date(donation.createdTime)
              return donationDate >= startOfMonth && donationDate <= endOfMonth
            }
          )

          setMonthlyDonorCount(monthlyDonations.length)
          const monthlyTotalCalc = monthlyDonations.reduce(
            (total: number, donation) => total + Number(donation.valueAtDonationTimeUSD || donation.amount || 0),
            0
          )

          setMonthlyTotal(monthlyTotalCalc)

          const timeLeft = endOfMonth.getTime() - currentDate.getTime()
          const daysLeft = Math.ceil(timeLeft / (1000 * 3600 * 24))
          setTimeLeftInMonth(daysLeft)
        }
      } catch (error) {
        console.error('Error fetching donation data:', error)
        setAddressStats({
          tx_count: 0,
          funded_txo_sum: 0,
          supporters: [],
        })
        setMatchingDonors([])
      }
    }

    fetchData()
  }, [
    project.slug,
    project.recurring,
    isMatching,
    matchingMultiplier,
    isBitcoinOlympics2024,
    recurringAmountGoal,
  ])

  // Handle modal opening based on query parameters
  useEffect(() => {
    const modal = searchParams.get('modal')
    const thankyou = searchParams.get('thankyou')
    
    if (modal === 'true') {
      setModalOpen(true)
      setSelectedProject(project)
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

    if (thankyou === 'true') {
      setThankYouModalOpen(true)
      setSelectedProject(project)
    }
  }, [searchParams, project, dispatch])

  const openPaymentModal = () => {
    // Prevent opening payment modal for completed or closed projects
    const normalizedStatus = project.status?.toLowerCase().trim() || ''
    const isCompletedOrClosed = 
      bountyStatus === BountyStatus.COMPLETED ||
      bountyStatus === BountyStatus.BOUNTY_COMPLETED ||
      bountyStatus === BountyStatus.CLOSED ||
      bountyStatus === BountyStatus.BOUNTY_CLOSED ||
      bountyStatus === BountyStatus.FUNDED ||
      normalizedStatus === 'completed' ||
      normalizedStatus === 'bounty completed' ||
      normalizedStatus === 'closed' ||
      normalizedStatus === 'bounty closed' ||
      normalizedStatus === 'archived' ||
      normalizedStatus === 'funding target reached'
    
    if (isCompletedOrClosed) {
      return // Don't open the modal for completed/closed projects
    }

    // Fresh donate session so a prior crypto address is not reused
    dispatch({ type: 'RESET_DONATION_STATE' })

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

    // Update URL with modal parameter
    const params = new URLSearchParams(searchParams.toString())
    params.set('modal', 'true')
    router.push(`/projects/${project.slug}?${params.toString()}`, { scroll: false })
  }

  const closeModal = () => {
    setModalOpen(false)
    setThankYouModalOpen(false)
    
    // Remove query parameters related to modal
    const params = new URLSearchParams(searchParams.toString())
    params.delete('modal')
    params.delete('thankyou')
    params.delete('name')
    
    const newQuery = params.toString()
    const newUrl = newQuery 
      ? `/projects/${project.slug}?${newQuery}`
      : `/projects/${project.slug}`
    
    router.push(newUrl, { scroll: false })
  }

  return (
    <div className="flex h-full w-screen max-w-none items-center bg-[#f2f2f2] bg-cover bg-center pb-8">
      <article className="relative mx-auto mt-32 flex min-h-screen w-[1300px] max-w-[90%] flex-col-reverse pb-16 lg:flex-row lg:items-start">
        <div className="content w-full leading-relaxed text-gray-800 lg:mr-5">
          <ProjectHeader title={project.name} summary={project.summary} />

          <ProjectMenu
            onMenuItemChange={setSelectedMenuItem}
            activeMenu={selectedMenuItem}
            commentCount={posts.length}
            faqCount={faqs.length}
            updatesCount={updates.length}
          />

          <div>
            <MenuSections
              selectedMenuItem={selectedMenuItem}
              title={project.name}
              content={project.content || ''}
              socialSummary={project.summary}
              faq={faqs}
              faqCount={faqs.length}
              updates={updates}
              selectedUpdateId={selectedUpdateId}
              setSelectedUpdateId={setSelectedUpdateId}
              hashtag=""
              tweetsData={posts}
              twitterContributors={[]}
              twitterContributorsBitcoin={project.bitcoinContributors || []}
              twitterContributorsLitecoin={project.litecoinContributors || []}
              twitterAdvocates={project.advocates || []}
              twitterUsers={[]}
              isBitcoinOlympics2024={false}
              formatLits={formatLits}
              formatUSD={formatUSD}
              website={project.website || ''}
              gitRepository={project.github || ''}
              twitterHandle={project.twitter || ''}
              discordLink={project.discord || ''}
              telegramLink={project.telegram || ''}
              facebookLink={project.facebook || ''}
              redditLink={project.reddit || ''}
            />
          </div>
        </div>

        <AsideSection
          title={project.name}
          coverImage={project.coverImage || ''}
          addressStats={addressStats as AddressStats}
          isMatching={isMatching || true}
          isBitcoinOlympics2024={isBitcoinOlympics2024 || false}
          isRecurring={project.recurring}
          matchingDonors={Array.isArray(matchingDonors) ? matchingDonors : []}
          matchingTotal={matchingTotal}
          serviceFeeCollected={project.serviceFeesCollected || 0}
          totalPaid={project.totalPaid || 0}
          litecoinRaised={litecoinRaised || 0}
          litecoinPaid={litecoinPaid || 0}
          formatLits={formatLits}
          formatUSD={formatUSD}
          monthlyTotal={monthlyTotal}
          recurringAmountGoal={recurringAmountGoal}
          monthlyDonorCount={monthlyDonorCount}
          timeLeftInMonth={timeLeftInMonth}
          bountyStatus={bountyStatus as BountyStatus}
          projectStatus={project.status}
          donationTarget={donationTarget}
          fundingProgressReady={fundingProgressReady}
          openPaymentModal={openPaymentModal}
        />
      </article>

      {/* Modals */}
      <PaymentModal
        isOpen={modalOpen}
        onRequestClose={closeModal}
        project={selectedProject}
      />
      <ThankYouModal
        isOpen={isThankYouModalOpen}
        onRequestClose={closeModal}
        project={selectedProject}
      />
    </div>
  )
}

