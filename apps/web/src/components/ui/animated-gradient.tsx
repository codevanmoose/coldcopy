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
      <div className="absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 via-purple-600/30 to-pink-600/30 animate-pulse" 
             style={{ animationDuration: '4s' }} />
      </div>
      
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 animate-pulse" 
             style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>
      
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/20 via-violet-500/20 to-indigo-500/20 animate-pulse" 
             style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>
      
      {/* Moving orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-r from-violet-400/10 to-purple-600/10 animate-float" />
      <div className="absolute top-3/4 right-1/4 w-72 h-72 rounded-full bg-gradient-to-r from-pink-400/10 to-cyan-400/10 animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full bg-gradient-to-r from-indigo-400/10 to-blue-600/10 animate-float-slow" />
      
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          33% {
            transform: translateY(-20px) translateX(30px) scale(1.1);
          }
          66% {
            transform: translateY(20px) translateX(-20px) scale(0.9);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          33% {
            transform: translateY(30px) translateX(-25px) scale(0.8);
          }
          66% {
            transform: translateY(-15px) translateX(35px) scale(1.2);
          }
        }
        
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px) translateX(0px) scale(1) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) translateX(20px) scale(1.1) rotate(180deg);
          }
        }
        
        .animate-float {
          animation: float 12s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 15s ease-in-out infinite;
          animation-delay: 2s;
        }
        
        .animate-float-slow {
          animation: float-slow 20s ease-in-out infinite;
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}