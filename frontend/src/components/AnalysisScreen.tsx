import { useEffect, useState } from 'react'

interface AnalysisScreenProps {
  onComplete: () => void
}

export function AnalysisScreen({ onComplete }: AnalysisScreenProps) {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const analysisSteps = [
    { icon: '🧠', label: 'Analyzing your current state...', detail: 'Processing energy, motivation, and readiness' },
    { icon: '📊', label: 'Reviewing session history...', detail: 'Comparing with your past 30 sessions' },
    { icon: '💪', label: 'Assessing recovery status...', detail: 'Checking muscle fatigue and injury patterns' },
    { icon: '🎯', label: 'Matching goals to conditions...', detail: 'Optimizing for your session focus' },
    { icon: '✨', label: 'Generating recommendations...', detail: 'Creating personalized insights' },
  ]

  // Lock body scroll when analysis screen is shown
  useEffect(() => {
    // Prevent scrolling on mount
    document.body.style.overflow = 'hidden'
    
    // Re-enable scrolling on unmount
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    // Simulate analysis progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 2
      })
    }, 60)

    // Cycle through steps
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= analysisSteps.length - 1) {
          return prev
        }
        return prev + 1
      })
    }, 600)

    // Complete after ~3 seconds
    const completeTimeout = setTimeout(() => {
      onComplete()
    }, 3200)

    return () => {
      clearInterval(progressInterval)
      clearInterval(stepInterval)
      clearTimeout(completeTimeout)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f0d] flex flex-col items-center justify-center px-4">
      {/* Animated brain/analysis icon */}
      <div className="relative mb-8">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-transparent border-t-fuchsia-500 border-r-cyan-500 animate-spin" style={{ animationDuration: '2s' }} />
        
        {/* Middle pulsing ring */}
        <div className="absolute inset-2 w-28 h-28 rounded-full border-2 border-fuchsia-500/30 animate-pulse" />
        
        {/* Inner icon container */}
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
          <span className="text-5xl animate-bounce" style={{ animationDuration: '1.5s' }}>
            {analysisSteps[currentStep].icon}
          </span>
        </div>

        {/* Floating particles */}
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-fuchsia-500 animate-ping opacity-75" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-cyan-500 animate-ping opacity-75" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 -right-4 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" style={{ animationDelay: '1s' }} />
      </div>

      {/* Current step text */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
          {analysisSteps[currentStep].label}
        </h2>
        <p className="text-slate-400 text-sm">
          {analysisSteps[currentStep].detail}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Analyzing...</span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mt-8">
        {analysisSteps.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index <= currentStep
                ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500 scale-100'
                : 'bg-white/20 scale-75'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

