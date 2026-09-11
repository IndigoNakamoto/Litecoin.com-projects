'use client'

import React from 'react'

export type FundingTargetProgressProps = {
  /** Total raised (community + matched USD), already rounded to cents */
  current: number
  /** Funding goal in USD */
  target: number
  formatUSD: (value: number) => string
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

export default function FundingTargetProgress({
  current,
  target,
  formatUSD,
}: FundingTargetProgressProps) {
  const safeCurrent = Math.max(0, toFiniteNumber(current))
  const parsedTarget = toFiniteNumber(target)
  const safeTarget = parsedTarget > 0 ? parsedTarget : 1
  const rawPercent = (safeCurrent / safeTarget) * 100
  const fillPercent = Math.min(100, rawPercent)
  const pctWhole = Math.round(fillPercent)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-sm bg-gray-300/90"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctWhole}
        aria-label={`Funding progress: ${pctWhole} percent of $ ${formatUSD(parsedTarget)} goal`}
      >
        <div
          className="h-full rounded-sm bg-[#345D9D]"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">
        {pctWhole}% of $ {formatUSD(parsedTarget)} goal
      </p>
    </div>
  )
}
