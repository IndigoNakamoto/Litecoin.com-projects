'use client'

import React from 'react'
import FundingTargetProgress from './FundingTargetProgress'
import { AddressStats } from '@/utils/types'
import { defaultAddressStats } from '@/utils/defaultValues'

type SharedStatsProps = {
  addressStats: AddressStats
  formatUSD: (value: number) => string
  totalPaid?: number
}

type StatItemProps = {
  value: string | number | React.ReactNode
  label: string
}

const StatItem: React.FC<StatItemProps> = ({ value, label }) => (
  <div>
    <h4 className="font-space-grotesk text-3xl font-semibold" style={{ color: '#345D9D' }}>
      {value}
    </h4>
    <h4 className="text-black">{label}</h4>
  </div>
)

const StandardStats: React.FC<
  SharedStatsProps & {
    formatLits?: (value: number) => string
    litecoinRaised?: number
    litecoinPaid?: number
    donationTarget?: number
    fundingProgressReady?: boolean
    matchingDonors?: {
      totalMatchedAmount: number
      donorFieldData: { name: string }
    }[]
  }
> = ({
  addressStats,
  formatUSD,
  formatLits,
  litecoinRaised = 0,
  litecoinPaid = 0,
  donationTarget,
  fundingProgressReady = false,
  matchingDonors = [],
  totalPaid = 0,
}) => {
  const communityRaisedUSD = Number(addressStats.funded_txo_sum)
  const raisedUsd = Number.isFinite(communityRaisedUSD) ? communityRaisedUSD : 0
  const parsedDonationTarget = Number(donationTarget)
  const safeDonationTarget =
    Number.isFinite(parsedDonationTarget) && parsedDonationTarget > 0
      ? parsedDonationTarget
      : undefined
  // Ensure matchingDonors is an array before calling reduce
  const donorsArray = Array.isArray(matchingDonors) ? matchingDonors : []
  const totalMatched = donorsArray.reduce(
    (sum, donor) => {
      // Extract totalMatchedAmount from donor object
      // Handle both direct property access and nested access
      let amount = 0
      if (donor && typeof donor === 'object') {
        if ('totalMatchedAmount' in donor) {
          amount = Number(donor.totalMatchedAmount) || 0
        }
      }
      // Use Decimal-like precision by rounding to avoid floating point errors
      return Math.round((sum + amount) * 100) / 100
    },
    0
  )

  const formattedCommunityLtc = litecoinRaised.toFixed(2)
  const formattedLtcPaid = litecoinPaid.toFixed(2)

  const hasLtcPaid = litecoinPaid > 0 && !!formatLits
  const hasUsdPaid = totalPaid > 0

  const showFundingTarget = safeDonationTarget != null

  const totalRaisedTowardTarget =
    Math.round((raisedUsd + totalMatched) * 100) / 100

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-5">
        <h3 className="font-space-grotesk text-lg font-bold text-gray-800">
          Funding Summary
        </h3>
        {showFundingTarget && (
          <div>
            {fundingProgressReady ? (
              <FundingTargetProgress
                current={totalRaisedTowardTarget}
                target={safeDonationTarget}
                formatUSD={formatUSD}
              />
            ) : (
              <div
                className="h-1.5 w-full animate-pulse rounded-sm bg-gray-400/50"
                aria-busy="true"
                aria-label="Loading funding progress"
              />
            )}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <StatItem
            value={addressStats.tx_count || 0}
            label="Number of Donations"
          />
          {litecoinRaised > 0 && (
            <StatItem
              value={`Ł ${formattedCommunityLtc}`}
              label="Community Raised (LTC)"
            />
          )}
          <StatItem
            value={`$ ${formatUSD(raisedUsd)}`}
            label="Community Donations (USD)"
          />

          {totalMatched > 0 && (
            <StatItem
              value={`$ ${formatUSD(totalMatched)}`}
              label="Matching Contributions"
            />
          )}
        </div>
      </div>

      <div className="border-t border-gray-400/60 pt-5">
        <div className="flex flex-col gap-5">
          <h3 className="font-space-grotesk text-lg font-bold text-gray-800">
            Impact Summary
          </h3>
          <div className="flex flex-col gap-4">
            <StatItem
              value={
                <>
                  {hasLtcPaid && `Ł ${formattedLtcPaid}`}
                  {hasLtcPaid && hasUsdPaid && ' + '}
                  {hasUsdPaid && `$ ${formatUSD(totalPaid)}`}
                  {!hasLtcPaid && !hasUsdPaid && `$ ${formatUSD(0)}`}
                </>
              }
              label="Paid to Contributors"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

type DonationStatsProps = {
  addressStats?: AddressStats
  formatUSD: (value: number | string) => string
  formatLits?: (value: number) => string
  isBitcoinOlympics2024?: boolean
  isRecurring?: boolean
  litecoinRaised?: number
  litecoinPaid?: number
  donationTarget?: number
  fundingProgressReady?: boolean
  matchingDonors?: {
    totalMatchedAmount: number
    donorFieldData: { name: string }
  }[]
  matchingTotal?: number
  monthlyDonorCount?: number
  monthlyTotal?: number
  recurringAmountGoal?: number
  timeLeftInMonth?: number
  totalPaid?: number
}

const DonationStats: React.FC<DonationStatsProps> = ({
  addressStats = defaultAddressStats,
  formatUSD,
  totalPaid,
  ...props
}) => {
  // For now, just use StandardStats
  // Can add BitcoinOlympicsStats and RecurringStats later if needed
  // isBitcoinOlympics2024 and isRecurring are passed via ...props for future use
  return (
    <StandardStats
      addressStats={addressStats}
      formatUSD={formatUSD}
      totalPaid={totalPaid}
      {...props}
    />
  )
}

export default DonationStats

