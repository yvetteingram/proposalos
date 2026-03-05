import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import type { ProposalIntake, ProposalMetrics, ProposalAIOutput, ScopeAudit, CloseOptimization } from '../types'
import { formatCurrency, formatPercent } from './metrics'
import { callGroq } from '../services/groq'
import { supabase } from '../services/supabase'

const MONTHLY_LIMIT = 50

interface ProposalOutputProps {
  intake: ProposalIntake
  metrics: ProposalMetrics
  aiOutput?: ProposalAIOutput
  onReady: (output: ProposalAIOutput) => void
  onBack: () => void
  onStartOver?: () => void
  userId: string
}

export function ProposalOutput({ intake, metrics, aiOutput, onReady, onBack, onStartOver, userId }: ProposalOutputProps) {
  const [loading, setLoading] = useState(!aiOutput)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'proposal' | 'audit' | 'close'>('proposal')
  const [exporting, setExporting] = useState(false)
  const [usageCount, setUsageCount] = useState<number | null>(null)

  useEffect(() => {
    if (aiOutput) return
    generateOutput()
  }, [])

  const checkUsage = async (): Promise<boolean> => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count, error } = await supabase
      .from('proposal_runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth)
    if (error) return true
    setUsageCount(count ?? 0)
    return (count ?? 0) < MONTHLY_LIMIT
  }

  const logRun = async () => {
    await supabase
      .from('proposal_runs')
      .insert({ user_id: userId, created_at: new Date().toISOString() })
  }

  const generateOutput = async () => {
    setLoading(true)
    setError(null)
    try {
      const withinLimit = await checkUsage()
      if (!withinLimit) {
        setError('LIMIT_REACHED')
        return
      }
      const prompt = buildPrompt(intake, metrics)
      const raw = await callGroq([{ role: 'user', content: prompt }])
      const parsed = parseAIOutput(raw)
      await logRun()
      onReady(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    if (!aiOutput) return
    setExporting(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 20
      const contentW = pageW - margin * 2
      let y = margin

      const addText = (text: string, size: number, bold = false, color: [number,number,number] = [40,40,60]) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, contentW)
        const lineH = size * 0.42
        if (y + lines.length * lineH > 275) { doc.addPage(); y = margin }
        doc.text(lines, margin, y)
        y += lines.length * lineH + 2
      }

      const addDivider = () => {
        doc.setDrawColor(210, 210, 230)
        doc.line(margin, y, pageW - margin, y)
        y += 6
      }

      const addSectionHeader = (title: string) => {
        y += 3
        doc.setFillColor(240, 238, 255)
        doc.rect(margin, y - 3, contentW, 8, 'F')
        addText(title, 9, true, [90, 60, 200])
        y += 1
      }

      // Cover block
      doc.setFillColor(15, 17, 30)
      doc.rect(0, 0, pageW, 45, 'F')
      doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255)
      doc.text('ProposalOS', margin, 20)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(160,160,200)
      doc.text('Strategic Proposal Package', margin, 28)
      doc.setFontSize(9); doc.setTextColor(110,110,160)
      doc.text(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), margin, 36)
      y = 55

      // Client + deal summary
      addText(intake.clientName, 16, true, [20,20,40])
      addText(intake.projectDescription, 10, false, [80,80,110])
      y += 3
      addDivider()

      addSectionHeader('DEAL PROFITABILITY SUMMARY')
      const rows = [
        ['Deal Value', formatCurrency(intake.totalRevenue)],
        ['Fully Loaded Cost', formatCurrency(metrics.fullyLoadedCost)],
        ['Implied Margin', formatPercent(metrics.impliedMargin) + ' (' + metrics.marginFlag.toUpperCase() + ')'],
        ['Break-Even Price', formatCurrency(metrics.breakEvenPrice)],
        ['Minimum Safe Price', formatCurrency(metrics.minimumSafePrice)],
        ['Recommended Price', formatCurrency(metrics.recommendedTargetPrice)],
        ['Capacity Risk', metrics.capacityRisk],
      ]
      rows.forEach(([label, value]) => {
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(90,90,120)
        doc.text(label, margin, y)
        doc.setFont('helvetica','bold'); doc.setTextColor(20,20,40)
        doc.text(value, pageW - margin, y, { align: 'right' })
        y += 6
      })

      if (metrics.redFlags.length > 0) {
        y += 3
        addSectionHeader('RISK FLAGS')
        metrics.redFlags.forEach(f => addText('! ' + f, 9, false, [180,60,60]))
      }

      // Proposal page
      doc.addPage(); y = margin
      addText('PROPOSAL', 13, true, [80,60,180])
      addDivider()
      aiOutput.proposalMarkdown.replace(/\*\*(.*?)\*\*/g,'$1').split('\n').forEach(line => {
        if (line.startsWith('# ')) addText(line.slice(2), 12, true, [20,20,40])
        else if (line.startsWith('## ')) { y+=2; addText(line.slice(3), 10, true, [60,60,180]) }
        else if (line.startsWith('- ')) addText('  • ' + line.slice(2), 9, false, [60,60,90])
        else if (line.trim()) addText(line, 9, false, [60,60,90])
        else y += 3
      })

      // Scope audit page
      doc.addPage(); y = margin
      addText('SCOPE AUDIT', 13, true, [80,60,180])
      addDivider()
      addText('Risk Score: ' + aiOutput.scopeAudit.riskScore + '/10', 11, true, [20,20,40])
      addText('Primary Exposure: ' + aiOutput.scopeAudit.primaryExposure, 9, false, [60,60,90])
      y += 3
      addSectionHeader('RISK FINDINGS')
      aiOutput.scopeAudit.findings.forEach(f => addText('• ' + f, 9, false, [60,60,90]))
      y += 3
      addSectionHeader('RECOMMENDED FIXES')
      aiOutput.scopeAudit.recommendedFixes.forEach(f => addText('+ ' + f, 9, false, [40,120,80]))

      // Close strategy page
      doc.addPage(); y = margin
      addText('CLOSE STRATEGY', 13, true, [80,60,180])
      addDivider()
      addText('Close Probability: ' + aiOutput.closeOptimization.closeProbability + '%', 11, true, [20,20,40])
      addText('Primary Objection: ' + aiOutput.closeOptimization.primaryObjection, 9, false, [60,60,90])
      y += 3
      addSectionHeader('NEGOTIATION STRATEGY')
      addText(aiOutput.closeOptimization.negotiationStrategy, 9, false, [60,60,90])
      y += 3
      addSectionHeader('OBJECTION RESPONSE SCRIPTS')
      const scripts = [
        ["That's too expensive", aiOutput.closeOptimization.responseScripts.tooExpensive],
        ["Can you add more scope?", aiOutput.closeOptimization.responseScripts.addMoreScope],
        ["Can you discount?", aiOutput.closeOptimization.responseScripts.discountRequest],
        ["We need to delay", aiOutput.closeOptimization.responseScripts.delay],
      ]
      scripts.forEach(([obj, res]) => {
        addText('"' + obj + '"', 9, true, [80,60,160])
        addText(res, 9, false, [60,60,90])
        y += 3
      })

      const filename = `ProposalOS_${intake.clientName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-white text-xl font-bold mb-2">Building Your Proposal Package</h2>
        <p className="text-white/60 text-base">Running scope audit, margin stress test, and close optimization…</p>
      </div>
    )
  }

  if (error === 'LIMIT_REACHED') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">⚡</div>
        <h2 className="text-white text-xl font-bold mb-2">Monthly Limit Reached</h2>
        <p className="text-white/60 text-base mb-2">You have used all {MONTHLY_LIMIT} proposals for this month.</p>
        <p className="text-white/40 text-sm mb-6">Your limit resets on the 1st of next month.</p>
        <button onClick={onBack} className="text-base text-white/60 hover:text-white/80 transition-colors px-4 py-2">← Back</button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">⚠</div>
        <h2 className="text-white text-xl font-bold mb-2">Generation Failed</h2>
        <p className="text-white/60 text-base mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onBack} className="text-base text-white/60 hover:text-white/80 transition-colors px-4 py-2">← Back</button>
          <button onClick={generateOutput} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">Try Again</button>
        </div>
      </div>
    )
  }

  if (!aiOutput) return null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-white text-2xl font-bold">Proposal Package</h1>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="text-base text-white/70 hover:text-white border border-white/12 hover:border-white/30 rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
        <p className="text-white/60 text-base">{intake.clientName} · {formatCurrency(intake.totalRevenue)} · {formatPercent(metrics.impliedMargin)} margin</p>
      </div>

      <div className="flex bg-[#1c1f2e] rounded-xl p-1 mb-6">
        {([
          { key: 'proposal', label: 'Proposal' },
          { key: 'audit',    label: 'Scope Audit' },
          { key: 'close',    label: 'Close Strategy' },
        ] as { key: typeof activeTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-base font-medium rounded-lg transition-colors ${
              activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-white/60 hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'proposal' && (
        <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-6 space-y-2">
          {aiOutput.proposalMarkdown.split('\n').map((line, i) => {
            if (line.startsWith('## ')) return <h2 key={i} className="text-white font-bold text-lg mt-5 mb-2">{line.slice(3)}</h2>
            if (line.startsWith('# '))  return <h1 key={i} className="text-white font-bold text-xl mt-6 mb-3">{line.slice(2)}</h1>
            if (line.startsWith('- '))  return <li key={i} className="text-white/80 text-base ml-4 list-disc">{line.slice(2)}</li>
            if (line.trim() === '')     return <div key={i} className="h-2" />
            return <p key={i} className="text-white/80 text-base leading-relaxed">{line}</p>
          })}
        </div>
      )}

      {activeTab === 'audit' && <ScopeAuditTab audit={aiOutput.scopeAudit} />}
      {activeTab === 'close' && <CloseTab close={aiOutput.closeOptimization} />}

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
        <button onClick={onBack} className="text-base text-white/60 hover:text-white/80 transition-colors">← Back to Metrics</button>
        {onStartOver && (
          <button onClick={onStartOver} className="bg-[#1c1f2e] hover:bg-[#222538] border border-white/12 text-white/80 font-medium px-5 py-2.5 rounded-xl text-base transition-colors">
            New Deal →
          </button>
        )}
      </div>
    </div>
  )
}

function ScopeAuditTab({ audit }: { audit: ScopeAudit }) {
  const riskColor = audit.riskScore >= 7 ? 'text-red-400' : audit.riskScore >= 4 ? 'text-yellow-400' : 'text-green-400'
  return (
    <div className="space-y-4">
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/60 text-sm uppercase tracking-wider">Scope Risk Score</p>
          <span className={`text-2xl font-bold ${riskColor}`}>{audit.riskScore}/10</span>
        </div>
        <p className="text-white/70 text-base"><span className="text-white/50">Primary Exposure: </span>{audit.primaryExposure}</p>
      </div>
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <p className="text-white/60 text-sm uppercase tracking-wider mb-3">Risk Findings</p>
        <ul className="space-y-2">{audit.findings.map((f,i) => <li key={i} className="text-white/80 text-base flex items-start gap-2"><span className="text-red-400 shrink-0">•</span>{f}</li>)}</ul>
      </div>
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <p className="text-white/60 text-sm uppercase tracking-wider mb-3">Recommended Fixes</p>
        <ul className="space-y-2">{audit.recommendedFixes.map((f,i) => <li key={i} className="text-white/80 text-base flex items-start gap-2"><span className="text-green-400 shrink-0">✓</span>{f}</li>)}</ul>
      </div>
    </div>
  )
}

function CloseTab({ close }: { close: CloseOptimization }) {
  const scripts = [
    { objection: "That's too expensive", response: close.responseScripts.tooExpensive },
    { objection: "Can you add more scope?", response: close.responseScripts.addMoreScope },
    { objection: "Can you discount?", response: close.responseScripts.discountRequest },
    { objection: "We need to delay", response: close.responseScripts.delay },
  ]
  return (
    <div className="space-y-4">
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/60 text-sm uppercase tracking-wider">Close Probability</p>
          <span className="text-2xl font-bold text-violet-300">{close.closeProbability}%</span>
        </div>
        <p className="text-white/70 text-base"><span className="text-white/50">Primary Objection: </span>{close.primaryObjection}</p>
      </div>
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <p className="text-white/60 text-sm uppercase tracking-wider mb-2">Negotiation Strategy</p>
        <p className="text-white/80 text-base leading-relaxed">{close.negotiationStrategy}</p>
      </div>
      <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-5">
        <p className="text-white/60 text-sm uppercase tracking-wider mb-4">Objection Response Scripts</p>
        <div className="space-y-5">
          {scripts.map((s,i) => (
            <div key={i}>
              <p className="text-white/60 text-sm font-semibold mb-2">"{s.objection}"</p>
              <p className="text-white/80 text-base bg-[#222538] rounded-xl p-4 border border-white/8 leading-relaxed">{s.response}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildPrompt(intake: ProposalIntake, metrics: ProposalMetrics): string {
  return `You are a strategic pricing consultant for boutique marketing agencies. Generate a complete proposal package for this deal.

DEAL DATA:
- Client: ${intake.clientName}
- Project: ${intake.projectDescription}
- Deal Type: ${intake.dealType}
- Proposed Price: $${intake.totalRevenue.toLocaleString()}
- Delivery Hours: ${intake.estimatedHours}
- Timeline: ${intake.timelineWeeks} weeks
- Implied Margin: ${Math.round(metrics.impliedMargin * 100)}%
- Margin Flag: ${metrics.marginFlag.toUpperCase()}
- Capacity Risk: ${metrics.capacityRisk}
- Strategic Value: ${intake.strategicValue}
- Break-Even: $${Math.round(metrics.breakEvenPrice).toLocaleString()}
- Recommended Price: $${Math.round(metrics.recommendedTargetPrice).toLocaleString()}

Respond ONLY with valid JSON. No markdown. No explanation. No preamble.

{
  "proposalMarkdown": "Full proposal text using # and ## headers and - bullet points",
  "scopeAudit": {
    "riskScore": 1-10,
    "primaryExposure": "single sentence",
    "findings": ["finding 1", "finding 2", "finding 3"],
    "recommendedFixes": ["fix 1", "fix 2", "fix 3"]
  },
  "closeOptimization": {
    "closeProbability": 0-100,
    "primaryObjection": "single sentence",
    "negotiationStrategy": "2-3 sentence strategy",
    "responseScripts": {
      "tooExpensive": "response script",
      "addMoreScope": "response script",
      "discountRequest": "response script",
      "delay": "response script"
    }
  }
}`
}

function parseAIOutput(raw: string): ProposalAIOutput {
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean) as ProposalAIOutput
  } catch {
    return {
      proposalMarkdown: raw,
      scopeAudit: {
        riskScore: 5,
        primaryExposure: 'Unable to parse structured output',
        findings: ['Review the proposal text manually'],
        recommendedFixes: ['Re-run generation if needed'],
      },
      closeOptimization: {
        closeProbability: 60,
        primaryObjection: 'Unable to parse structured output',
        negotiationStrategy: 'Review the proposal text and apply standard negotiation principles.',
        responseScripts: {
          tooExpensive: 'Let me walk you through the value breakdown...',
          addMoreScope: 'Any additional scope would require a change order...',
          discountRequest: 'Our pricing reflects the full value delivered...',
          delay: 'I want to make sure we can still hit your timeline...',
        },
      },
    }
  }
}