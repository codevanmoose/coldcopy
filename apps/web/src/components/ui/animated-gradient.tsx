'use client'

interface AnimatedGradientProps {
  className?: string
}

export function AnimatedGradient({ className = '' }: AnimatedGradientProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* Base animated gradient */}
      <div className="absolute inset-0" 
           style={{ 
             background: 'linear-gradient(125deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #667eea 100%)',
             backgroundSize: '400% 400%',
             animation: 'gradient-shift 15s ease infinite',
           }} />
      
      {/* Animated overlay gradients with custom animations */}
      <div className="absolute inset-0 animate-gradient-pulse" style={{ animationDelay: '0s' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/40 via-purple-500/40 to-pink-500/40" />
      </div>
      
      <div className="absolute inset-0 animate-gradient-pulse" style={{ animationDelay: '1s', animationDuration: '6s' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 via-blue-400/30 to-purple-400/30" />
      </div>
      
      <div className="absolute inset-0 animate-gradient-pulse" style={{ animationDelay: '2s', animationDuration: '8s' }}>
        <div className="absolute inset-0 bg-gradient-to-tl from-pink-400/25 via-violet-400/25 to-indigo-400/25" />
      </div>
      
      {/* Moving orbs with custom animations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-r from-violet-400/20 to-purple-600/20 blur-3xl animate-orb-float" />
      <div className="absolute top-3/4 right-1/4 w-72 h-72 rounded-full bg-gradient-to-r from-pink-400/20 to-cyan-400/20 blur-3xl animate-orb-float-delayed" />
      <div className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full bg-gradient-to-r from-indigo-400/20 to-blue-600/20 blur-2xl animate-orb-float-slow" />
    </div>
  )
}