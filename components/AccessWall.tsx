interface AccessWallProps {
  onSignOut: () => void
}

export function AccessWall({ onSignOut }: AccessWallProps) {
  return (
    <div className="min-h-screen bg-[#0f0e17] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#1c1f2e] border border-white/12 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-400 text-xl">⚠</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">No Access Found</h2>
        <p className="text-white/70 text-base mb-6">
          Your account doesn't have an active ProposalOS license. Purchase ProposalOS on Gumroad, then sign in with the same email.
        </p>
        <a
          href="https://ketorahdigital.gumroad.com/l/proposalos"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
        >
          Purchase ProposalOS →
        </a>
        <button
          onClick={onSignOut}
          className="text-sm text-white/50 hover:text-white/60 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}