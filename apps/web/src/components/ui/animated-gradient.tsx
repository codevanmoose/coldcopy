'use client'

interface AnimatedGradientProps {
  className?: string
}

export function AnimatedGradient({ className = '' }: AnimatedGradientProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
      
      {/* Animated overlay gradients */}
      <div className="absolute inset-0 opacity-60 animate-pulse" style={{ animationDuration: '4s' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 via-purple-600/30 to-pink-600/30" />
      </div>
      
      <div className="absolute inset-0 opacity-40 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20" />
      </div>
      
      <div className="absolute inset-0 opacity-30 animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }}>
        <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/20 via-violet-500/20 to-indigo-500/20" />
      </div>
      
      {/* Moving orbs - simplified for better compatibility */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-r from-violet-400/10 to-purple-600/10 animate-bounce" style={{ animationDuration: '12s' }} />
      <div className="absolute top-3/4 right-1/4 w-72 h-72 rounded-full bg-gradient-to-r from-pink-400/10 to-cyan-400/10 animate-bounce" style={{ animationDuration: '15s', animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full bg-gradient-to-r from-indigo-400/10 to-blue-600/10 animate-bounce" style={{ animationDuration: '20s', animationDelay: '4s' }} />
    </div>
  )
}