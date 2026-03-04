import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './services/supabase'

// Views
import { AuthView } from './components/AuthView'
import { IntakeForm } from './components/IntakeForm'
import { MetricsDisplay } from './components/MetricsDisplay'
import { ProposalOutput } from './components/ProposalOutput'
import { AccessWall } from './components/AccessWall'

// Types
import type { ProposalIntake, ProposalMetrics, ProposalAIOutput } from './types'

type AppView = 'intake' | 'metrics' | 'generating' | 'output'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [view, setView] = useState<AppView>('intake')

  // Proposal run state
  const [intake, setIntake] = useState<ProposalIntake | null>(null)
  const [metrics, setMetrics] = useState<ProposalMetrics | null>(null)
  const [aiOutput, setAiOutput] = useState<ProposalAIOutput | null>(null)

  // ── Auth session listener ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Access check after login ────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) {
      setHasAccess(false)
      return
    }

    setCheckingAccess(true)

    supabase
      .from('profiles')
      .select('proposalos_access')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setHasAccess(data?.proposalos_access ?? false)
        setCheckingAccess(false)
      })
  }, [session])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleIntakeComplete = (intakeData: ProposalIntake, metricsData: ProposalMetrics) => {
    setIntake(intakeData)
    setMetrics(metricsData)
    setView('metrics')
  }

  const handleGenerateProposal = () => {
    setView('generating')
  }

  const handleOutputReady = (output: ProposalAIOutput) => {
    setAiOutput(output)
    setView('output')
  }

  const handleStartOver = () => {
    setIntake(null)
    setMetrics(null)
    setAiOutput(null)
    setView('intake')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    handleStartOver()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen bg-[#13151f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <AuthView />
  }

  if (!hasAccess) {
    return <AccessWall onSignOut={handleSignOut} />
  }

  return (
    <div className="min-h-screen bg-[#13151f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold">P</div>
          <span className="font-semibold tracking-wide">ProposalOS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-base text-white/60">{session.user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-base text-white/60 hover:text-white/70 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-8 py-12">
        {view === 'intake' && (
          <IntakeForm onComplete={handleIntakeComplete} />
        )}

        {view === 'metrics' && intake && metrics && (
          <MetricsDisplay
            intake={intake}
            metrics={metrics}
            onGenerate={handleGenerateProposal}
            onBack={() => setView('intake')}
          />
        )}

        {view === 'generating' && intake && metrics && (
          <ProposalOutput
            intake={intake}
            metrics={metrics}
            onReady={handleOutputReady}
            onBack={() => setView('metrics')}
          />
        )}

        {view === 'output' && intake && metrics && aiOutput && (
          <ProposalOutput
            intake={intake}
            metrics={metrics}
            aiOutput={aiOutput}
            onReady={handleOutputReady}
            onBack={handleStartOver}
            onStartOver={handleStartOver}
          />
        )}
      </main>
    </div>
  )
}