'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step {
  id: string
  label: string
  labelEn?: string
  description?: string
  status: 'pending' | 'current' | 'completed' | 'error'
}

interface ConversionStepperProps {
  steps: Step[]
  onStepClick?: (stepId: string) => void
  allowNavigation?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function ConversionStepper({
  steps,
  onStepClick,
  allowNavigation = false,
  orientation = 'horizontal',
}: ConversionStepperProps) {
  const handleStepClick = (step: Step) => {
    if (allowNavigation && step.status === 'completed' && onStepClick) {
      onStepClick(step.id)
    }
  }

  if (orientation === 'vertical') {
    return (
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            onClick={() => handleStepClick(step)}
            className={cn(
              'flex gap-4',
              allowNavigation && step.status === 'completed' && 'cursor-pointer'
            )}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  step.status === 'completed' &&
                    'border-primary bg-primary text-primary-foreground',
                  step.status === 'current' && 'border-primary bg-background text-primary',
                  step.status === 'error' &&
                    'border-destructive bg-destructive text-destructive-foreground',
                  step.status === 'pending' &&
                    'border-muted-foreground/30 bg-background text-muted-foreground'
                )}
              >
                {step.status === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-12 w-0.5',
                    step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>

            <div className="pt-1.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.status === 'current' && 'text-foreground',
                  step.status !== 'current' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center">
            <div
              onClick={() => handleStepClick(step)}
              className={cn(
                'flex flex-col items-center',
                allowNavigation && step.status === 'completed' && 'cursor-pointer'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  step.status === 'completed' &&
                    'border-primary bg-primary text-primary-foreground',
                  step.status === 'current' && 'border-primary bg-background text-primary',
                  step.status === 'error' &&
                    'border-destructive bg-destructive text-destructive-foreground',
                  step.status === 'pending' &&
                    'border-muted-foreground/30 bg-background text-muted-foreground'
                )}
              >
                {step.status === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              <p
                className={cn(
                  'mt-2 text-center text-xs font-medium',
                  step.status === 'current' && 'text-foreground',
                  step.status !== 'current' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
