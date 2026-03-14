'use client'

import { useEffect, useState } from 'react'
import type { ChatProgressStage, ChatProgressState } from './config'
import { PROGRESS_STAGES, calculateProgress } from './config'

function AnimatedDots() {
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4)
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return <span className="inline-block w-6 text-left">{'.'.repeat(dotCount)}</span>
}

function PersonaAnimation() {
  const personas = [
    { id: 'cpa', label: '公認会計士', color: 'bg-blue-500' },
    { id: 'tax', label: '税理士', color: 'bg-green-500' },
    { id: 'cfo', label: 'CFO', color: 'bg-purple-500' },
    { id: 'analyst', label: 'アナリスト', color: 'bg-orange-500' },
  ]

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % personas.length)
    }, 800)
    return () => clearInterval(interval)
  }, [personas.length])

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {personas.map((persona, index) => (
        <div
          key={persona.id}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition-all duration-300 ${
            index === activeIndex
              ? `${persona.color} scale-110 shadow-lg`
              : 'scale-90 bg-gray-300 opacity-50'
          }`}
        >
          {persona.label.slice(0, 2)}
        </div>
      ))}
    </div>
  )
}

interface ProgressIndicatorProps {
  progress: ChatProgressState
  showPersonaAnimation?: boolean
}

export function ProgressIndicator({
  progress,
  showPersonaAnimation = true,
}: ProgressIndicatorProps) {
  const { stage, message, subMessage, startTime } = progress
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime)
    }, 100)
    return () => clearInterval(interval)
  }, [startTime])

  if (stage === 'idle' || stage === 'complete' || stage === 'error') {
    return null
  }

  const stageInfo = PROGRESS_STAGES[stage]
  const progressPercent = calculateProgress(stage, elapsedMs)

  return (
    <div className="space-y-3 rounded-lg bg-muted/50 p-4">
      {showPersonaAnimation && <PersonaAnimation />}

      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <span>{stageInfo.label}</span>
          <AnimatedDots />
        </div>
        <p className="text-xs text-muted-foreground">{message || stageInfo.description}</p>
        {subMessage && <p className="text-xs text-muted-foreground/70">{subMessage}</p>}
      </div>

      <div className="space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progressPercent}%</span>
          <span>{(elapsedMs / 1000).toFixed(1)}秒</span>
        </div>
      </div>
    </div>
  )
}

interface StatusIconProps {
  stage: ChatProgressStage
  size?: 'sm' | 'md' | 'lg'
}

export function AnimatedStatusIcon({ stage, size = 'md' }: StatusIconProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  if (stage === 'idle') {
    return null
  }

  if (stage === 'error') {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-destructive`}
      >
        <span className="text-xs text-destructive-foreground">!</span>
      </div>
    )
  }

  if (stage === 'complete') {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-green-500`}
      >
        <span className="text-xs text-white">✓</span>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-muted border-t-primary`}
    />
  )
}
