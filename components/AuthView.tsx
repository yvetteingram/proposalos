import { useState } from 'react'
import { supabase } from '../services/supabase'

export function AuthView() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Check purchase before allowing signup
        const { data: profile } = await supabase
          .from('profiles')
          .select('proposalOS_access')
          .eq('email', email.toLowerCase().trim())
          .single()

        if (!profile?.proposalOS_access) {
          setError('No purchase found for this email. Buy ProposalOS on Gumroad first, then create your account with the same email.')
          setLoading(false)
          return
        }

        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        setSuccess('Account created! Check your email to confirm, then sign in.')

      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">P</div>
          <h1 className="text-white text-2xl font-bold">ProposalOS</h1>
          <p className="text-white/60 text-base mt-1">Stop underpricing your agency.</p>
        </div>

        {/* Card */}
        <div className="bg-[#1c1f2e] border border-white/12 rounded-2xl p-8">
          {/* Mode toggle */}
          <div className="flex bg-[#1c1f2e] rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'signin' ? 'bg-violet-600 text-white' : 'text-white/60 hover:text-white/70'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'signup' ? 'bg-violet-600 text-white' : 'text-white/60 hover:text-white/70'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3 mb-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[#1c1f2e] border border-white/12 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          {/* Purchase gate notice */}
          {mode === 'signup' && (
            <div className="mt-4 text-center">
              <p className="text-white/50 text-sm">
                Requires a ProposalOS purchase.{' '}
                <a
                  href="https://ketorahdigital.gumroad.com/l/proposalos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 underline"
                >
                  Buy here first →
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}