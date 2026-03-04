// ── Intake ────────────────────────────────────────────────────────────────────

export type DealType = 'project' | 'retainer'
export type StrategicValue = 'growth' | 'portfolio' | 'cashflow'
export type MarginFlag = 'red' | 'yellow' | 'green'
export type CapacityRisk = 'Low' | 'Moderate' | 'High'

export interface ProposalIntake {
  dealType: DealType
  totalRevenue: number
  estimatedHours: number
  blendedHourlyCost: number
  overheadPercent: number
  timelineWeeks: number
  strategicValue: StrategicValue
  clientName: string
  projectDescription: string
}

// ── Metrics (deterministic math) ─────────────────────────────────────────────

export interface ProposalMetrics {
  totalDeliveryCost: number
  fullyLoadedCost: number
  impliedMargin: number
  marginFlag: MarginFlag
  breakEvenPrice: number
  minimumSafePrice: number
  recommendedTargetPrice: number
  impliedHourlyRate: number
  capacityRisk: CapacityRisk
  redFlags: string[]
}

// ── AI Output ─────────────────────────────────────────────────────────────────

export interface ScopeAudit {
  riskScore: number
  primaryExposure: string
  findings: string[]
  recommendedFixes: string[]
}

export interface CloseOptimization {
  closeProbability: number
  primaryObjection: string
  negotiationStrategy: string
  responseScripts: {
    tooExpensive: string
    addMoreScope: string
    discountRequest: string
    delay: string
  }
}

export interface ProposalAIOutput {
  proposalMarkdown: string
  scopeAudit: ScopeAudit
  closeOptimization: CloseOptimization
}