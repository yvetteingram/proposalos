import type { ProposalIntake, ProposalMetrics, MarginFlag, CapacityRisk } from '../types'

export function calculateMetrics(intake: ProposalIntake): ProposalMetrics {
  const { totalRevenue, estimatedHours, blendedHourlyCost, overheadPercent, timelineWeeks } = intake

  const totalDeliveryCost = estimatedHours * blendedHourlyCost
  const fullyLoadedCost = totalDeliveryCost * (1 + overheadPercent / 100)
  const impliedMargin = totalRevenue > 0 ? (totalRevenue - fullyLoadedCost) / totalRevenue : 0
  const breakEvenPrice = fullyLoadedCost
  const minimumSafePrice = fullyLoadedCost / (1 - 0.45)
  const recommendedTargetPrice = fullyLoadedCost / (1 - 0.60)
  const impliedHourlyRate = estimatedHours > 0 ? totalRevenue / estimatedHours : 0
  const hoursPerWeek = timelineWeeks > 0 ? estimatedHours / timelineWeeks : estimatedHours
  const capacityRisk: CapacityRisk = hoursPerWeek > 35 ? 'High' : hoursPerWeek > 20 ? 'Moderate' : 'Low'
  const marginFlag: MarginFlag = impliedMargin < 0.45 ? 'red' : impliedMargin < 0.60 ? 'yellow' : 'green'

  const redFlags: string[] = []
  if (impliedMargin < 0.45) redFlags.push(`Margin is ${Math.round(impliedMargin * 100)}% — below the 45% minimum safe threshold`)
  if (capacityRisk === 'High') redFlags.push(`Capacity strain is High — ${Math.round(hoursPerWeek)} hrs/week required`)
  if (impliedHourlyRate < blendedHourlyCost) redFlags.push(`Implied rate ($${Math.round(impliedHourlyRate)}/hr) is below your cost ($${blendedHourlyCost}/hr)`)
  if (totalRevenue < breakEvenPrice) redFlags.push(`Proposed price is below break-even — this deal loses money`)

  return { totalDeliveryCost, fullyLoadedCost, impliedMargin, marginFlag, breakEvenPrice, minimumSafePrice, recommendedTargetPrice, impliedHourlyRate, capacityRisk, redFlags }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}