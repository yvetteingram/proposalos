import { useState } from 'react'
import type { ProposalIntake, ProposalMetrics, DealType, StrategicValue } from '../types'
import { calculateMetrics } from './metrics'

interface IntakeFormProps {
  onComplete: (intake: ProposalIntake, metrics: ProposalMetrics) => void
}

const STEPS = ['Deal Info', 'Financials', 'Timeline', 'Context'] as const
type Step = 0 | 1 | 2 | 3

export function IntakeForm({ onComplete }: IntakeFormProps) {
  const [step, setStep] = useState<Step>(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<ProposalIntake>({
    dealType: 'project',
    clientName: '',
    projectDescription: '',
    totalRevenue: 0,
    estimatedHours: 0,
    blendedHourlyCost: 0,
    overheadPercent: 20,
    timelineWeeks: 4,
    strategicValue: 'cashflow',
  })

  const update = (field: keyof ProposalIntake, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!form.clientName.trim()) newErrors.clientName = 'Client name is required'
      if (!form.projectDescription.trim()) newErrors.projectDescription = 'Project description is required'
    }
    if (step === 1) {
      if (!form.totalRevenue || form.totalRevenue <= 0) newErrors.totalRevenue = 'Enter the deal value'
      if (!form.estimatedHours || form.estimatedHours <= 0) newErrors.estimatedHours = 'Enter estimated hours'
      if (!form.blendedHourlyCost || form.blendedHourlyCost <= 0) newErrors.blendedHourlyCost = 'Enter your blended hourly cost'
    }
    if (step === 2) {
      if (!form.timelineWeeks || form.timelineWeeks <= 0) newErrors.timelineWeeks = 'Enter timeline in weeks'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep()) return
    if (step < 3) {
      setStep((step + 1) as Step)
    } else {
      const metrics = calculateMetrics(form)
      onComplete(form, metrics)
    }
  }

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as Step)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold mb-1">New Deal Analysis</h1>
        <p className="text-white/60 text-sm">Run the numbers before you send anything.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < step ? 'bg-violet-600 text-white' :
              i === step ? 'bg-violet-600 text-white' :
              'bg-[#222538] text-white/50'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm transition-colors ${i === step ? 'text-white' : 'text-white/50'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-[#222538] mx-1" />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-8">

        {/* Step 0 — Deal Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Deal Type
              </label>
              <div className="flex gap-3">
                {(['project', 'retainer'] as DealType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => update('dealType', type)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium capitalize transition-colors ${
                      form.dealType === type
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#1c1f2e] text-white/70 hover:text-white/80 border border-white/12'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Client Name
              </label>
              <input
                type="text"
                placeholder="Acme Marketing Agency"
                value={form.clientName}
                onChange={e => update('clientName', e.target.value)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.clientName && <p className="text-red-400 text-base mt-1">{errors.clientName}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                What are you delivering?
              </label>
              <textarea
                placeholder="Brand strategy + 3-month content rollout for Q1 product launch..."
                value={form.projectDescription}
                onChange={e => update('projectDescription', e.target.value)}
                rows={3}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors resize-none"
              />
              {errors.projectDescription && <p className="text-red-400 text-base mt-1">{errors.projectDescription}</p>}
            </div>
          </div>
        )}

        {/* Step 1 — Financials */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Deal Value (Total Revenue) $
              </label>
              <input
                type="number"
                placeholder="15000"
                value={form.totalRevenue || ''}
                onChange={e => update('totalRevenue', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.totalRevenue && <p className="text-red-400 text-base mt-1">{errors.totalRevenue}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Estimated Delivery Hours
              </label>
              <input
                type="number"
                placeholder="120"
                value={form.estimatedHours || ''}
                onChange={e => update('estimatedHours', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.estimatedHours && <p className="text-red-400 text-base mt-1">{errors.estimatedHours}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Your Blended Hourly Cost $ (what you pay your team per hour)
              </label>
              <input
                type="number"
                placeholder="65"
                value={form.blendedHourlyCost || ''}
                onChange={e => update('blendedHourlyCost', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.blendedHourlyCost && <p className="text-red-400 text-base mt-1">{errors.blendedHourlyCost}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Overhead % (software, admin, facilities — default 20%)
              </label>
              <input
                type="number"
                placeholder="20"
                value={form.overheadPercent || ''}
                onChange={e => update('overheadPercent', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 2 — Timeline */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Project Timeline (weeks)
              </label>
              <input
                type="number"
                placeholder="8"
                value={form.timelineWeeks || ''}
                onChange={e => update('timelineWeeks', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.timelineWeeks && <p className="text-red-400 text-base mt-1">{errors.timelineWeeks}</p>}
            </div>
          </div>
        )}

        {/* Step 3 — Context */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                Why are you taking this deal?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'cashflow', label: 'Cash Flow', desc: 'Need revenue now' },
                  { value: 'growth', label: 'Growth', desc: 'Strategic client' },
                  { value: 'portfolio', label: 'Portfolio', desc: 'Build credibility' },
                ] as { value: StrategicValue; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('strategicValue', opt.value)}
                    className={`p-4 rounded-xl text-left transition-colors border ${
                      form.strategicValue === opt.value
                        ? 'bg-violet-600/20 border-violet-500 text-white'
                        : 'bg-[#1c1f2e] border-white/12 text-white/70 hover:text-white/80'
                    }`}
                  >
                    <div className="font-semibold text-base mb-1">{opt.label}</div>
                    <div className="text-sm opacity-60">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1c1f2e] rounded-xl p-4 border border-white/12">
              <p className="text-white/60 text-sm">
                Ready to run the numbers on <span className="text-white/70">{form.clientName || 'this deal'}</span> — a{' '}
                <span className="text-white/70">${form.totalRevenue?.toLocaleString()}</span>{' '}
                {form.dealType} over <span className="text-white/70">{form.timelineWeeks} weeks</span>.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleBack}
            className={`text-sm text-white/60 hover:text-white/70 transition-colors ${step === 0 ? 'invisible' : ''}`}
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            {step < 3 ? 'Next →' : 'Run the Numbers →'}
          </button>
        </div>
      </div>
    </div>
  )
}