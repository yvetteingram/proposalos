import type { ProposalIntake, ProposalMetrics } from '../types'
import { formatCurrency, formatPercent } from './metrics'

interface MetricsDisplayProps {
  intake: ProposalIntake
  metrics: ProposalMetrics
  onGenerate: () => void
  onBack: () => void
}

const MARGIN_CONFIG = {
  red:    { label: 'Below Minimum',  bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
  yellow: { label: 'Acceptable',     bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  green:  { label: 'Strong',         bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400' },
}

const CAPACITY_CONFIG = {
  Low:      { text: 'text-green-400',  label: 'Low' },
  Moderate: { text: 'text-yellow-400', label: 'Moderate' },
  High:     { text: 'text-red-400',    label: 'High' },
}

export function MetricsDisplay({ intake, metrics, onGenerate, onBack }: MetricsDisplayProps) {
  const margin = MARGIN_CONFIG[metrics.marginFlag]
  const capacity = CAPACITY_CONFIG[metrics.capacityRisk]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold mb-1">Deal Profitability Baseline</h1>
        <p className="text-white/40 text-sm">{intake.clientName} — {intake.projectDescription.slice(0, 60)}{intake.projectDescription.length > 60 ? '…' : ''}</p>
      </div>

      {/* Red flags */}
      {metrics.redFlags.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-6">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">⚠ Deal Risk Flags</p>
          <ul className="space-y-2">
            {metrics.redFlags.map((flag, i) => (
              <li key={i} className="text-red-300 text-sm flex items-start gap-2">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Margin verdict */}
      <div className={`${margin.bg} border ${margin.border} rounded-2xl p-5 mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Implied Margin</p>
            <p className={`text-3xl font-bold ${margin.text}`}>{formatPercent(metrics.impliedMargin)}</p>
          </div>
          <div className={`px-3 py-1 rounded-full border ${margin.border} ${margin.bg}`}>
            <span className={`text-xs font-semibold ${margin.text}`}>{margin.label}</span>
          </div>
        </div>
      </div>

      {/* Key numbers grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricCard label="Deal Value" value={formatCurrency(intake.totalRevenue)} />
        <MetricCard label="Fully Loaded Cost" value={formatCurrency(metrics.fullyLoadedCost)} />
        <MetricCard label="Break-Even Price" value={formatCurrency(metrics.breakEvenPrice)} />
        <MetricCard label="Minimum Safe Price" value={formatCurrency(metrics.minimumSafePrice)} sublabel="45% margin floor" />
        <MetricCard label="Recommended Price" value={formatCurrency(metrics.recommendedTargetPrice)} sublabel="60% margin target" highlight />
        <MetricCard label="Implied Hourly Rate" value={`${formatCurrency(metrics.impliedHourlyRate)}/hr`} />
      </div>

      {/* Capacity risk */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Capacity Risk</p>
            <p className={`text-xl font-bold ${capacity.text}`}>{capacity.label}</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs mb-1">{intake.estimatedHours} hrs over {intake.timelineWeeks} weeks</p>
            <p className="text-white/60 text-sm">{Math.round(intake.estimatedHours / intake.timelineWeeks)} hrs/week required</p>
          </div>
        </div>
      </div>

      {/* Pricing guidance */}
      {intake.totalRevenue < metrics.minimumSafePrice && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-6">
          <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">Pricing Recommendation</p>
          <p className="text-white/70 text-sm">
            Your proposed price of <span className="text-white font-semibold">{formatCurrency(intake.totalRevenue)}</span> is below the minimum safe threshold.
            Consider repricing to at least <span className="text-yellow-300 font-semibold">{formatCurrency(metrics.minimumSafePrice)}</span> before sending this proposal.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          ← Edit Deal
        </button>
        <button
          onClick={onGenerate}
          className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Generate Proposal Package →
        </button>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string
  value: string
  sublabel?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-violet-600/10 border-violet-500/30' : 'bg-white/5 border-white/10'}`}>
      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-violet-300' : 'text-white'}`}>{value}</p>
      {sublabel && <p className="text-white/30 text-xs mt-0.5">{sublabel}</p>}
    </div>
  )
}