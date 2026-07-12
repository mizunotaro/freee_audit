import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversionStepper, type Step } from '@/components/conversion/stepper'

function step(overrides: Partial<Step> & { id: string }): Step {
  return { label: overrides.id, status: 'pending', ...overrides }
}

// A full flow exercising every status in document order.
const FLOW: Step[] = [
  step({ id: 'mapping', label: 'マッピング', status: 'completed', description: '完了済み' }),
  step({ id: 'validate', label: '検証', status: 'current', description: '実行中' }),
  step({ id: 'convert', label: '変換', status: 'pending' }),
  step({ id: 'review', label: 'レビュー', status: 'error', description: '失敗' }),
]

// Each step renders exactly one circle indicator (`.rounded-full`); connectors
// and labels never carry that class, so this returns steps in order.
function circles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.rounded-full')) as HTMLElement[]
}

describe('ConversionStepper — horizontal (default orientation)', () => {
  it('renders every step label in document order', () => {
    render(<ConversionStepper steps={FLOW} />)
    const labels = screen.getAllByText(/マッピング|検証|変換|レビュー/)
    expect(labels.map((el) => el.textContent)).toEqual(['マッピング', '検証', '変換', 'レビュー'])
  })

  it('renders one circle indicator per step', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    expect(circles(container)).toHaveLength(4)
  })

  it('uses the horizontal layout container (no vertical container)', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    expect(container.querySelector('.w-full')).not.toBeNull()
    expect(container.querySelector('.space-y-4')).toBeNull()
  })

  it('does NOT render descriptions in horizontal even when provided', () => {
    render(<ConversionStepper steps={FLOW} />)
    expect(screen.queryByText('完了済み')).not.toBeInTheDocument()
    expect(screen.queryByText('実行中')).not.toBeInTheDocument()
    expect(screen.queryByText('失敗')).not.toBeInTheDocument()
  })

  it('renders a horizontal connector bar between steps but not after the last', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    // `.mx-2` is carried only by horizontal connector bars.
    expect(container.querySelectorAll('.mx-2')).toHaveLength(3)
  })
})

describe('ConversionStepper — circle content (Check icon vs index number)', () => {
  it('shows the Check icon for a completed step and hides the number', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    const completed = circles(container)[0] // mapping = completed
    expect(completed.querySelector('svg')).not.toBeNull()
    expect(completed.querySelector('span')).toBeNull()
  })

  it('shows the 1-based index for every non-completed status and no icon', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    const list = circles(container)
    expect(list[1].querySelector('span')?.textContent).toBe('2') // current
    expect(list[1].querySelector('svg')).toBeNull()
    expect(list[2].querySelector('span')?.textContent).toBe('3') // pending
    expect(list[2].querySelector('svg')).toBeNull()
    expect(list[3].querySelector('span')?.textContent).toBe('4') // error
    expect(list[3].querySelector('svg')).toBeNull()
  })

  it('renders the Check icon for a completed step even at index 0', () => {
    const { container } = render(
      <ConversionStepper steps={[step({ id: 'a', label: 'A', status: 'completed' })]} />
    )
    expect(circles(container)[0].querySelector('svg')).not.toBeNull()
  })
})

describe('ConversionStepper — circle styling by status', () => {
  it.each([
    ['completed', ['border-primary', 'bg-primary', 'text-primary-foreground']],
    ['current', ['border-primary', 'bg-background', 'text-primary']],
    ['error', ['border-destructive', 'bg-destructive', 'text-destructive-foreground']],
    ['pending', ['border-muted-foreground/30', 'bg-background', 'text-muted-foreground']],
  ] as const)('applies %s styling to the circle', (status, classes) => {
    const { container } = render(
      <ConversionStepper
        steps={[step({ id: 'x', label: 'X', status: status as Step['status'] })]}
      />
    )
    const circle = circles(container)[0]
    for (const c of classes) expect(circle.className).toContain(c)
  })
})

describe('ConversionStepper — label styling by status', () => {
  it('highlights the current step label and mutes the others', () => {
    render(<ConversionStepper steps={FLOW} />)
    expect(screen.getByText('検証').className).toContain('text-foreground')
    for (const label of ['マッピング', '変換', 'レビュー'] as const) {
      expect(screen.getByText(label).className).toContain('text-muted-foreground')
    }
  })
})

describe('ConversionStepper — horizontal connector coloring', () => {
  it('colors a connector bg-primary when its step is completed, bg-muted otherwise', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    const connectors = container.querySelectorAll('.mx-2')
    // Connectors follow step 0 (completed), 1 (current), 2 (pending).
    expect(connectors[0].className).toContain('bg-primary')
    expect(connectors[1].className).toContain('bg-muted')
    expect(connectors[2].className).toContain('bg-muted')
  })

  it('renders no connector for a single step', () => {
    const { container } = render(
      <ConversionStepper steps={[step({ id: 'only', label: 'Only', status: 'current' })]} />
    )
    expect(container.querySelectorAll('.mx-2')).toHaveLength(0)
  })
})

describe('ConversionStepper — vertical orientation', () => {
  it('uses the vertical layout container', () => {
    const { container } = render(<ConversionStepper steps={FLOW} orientation="vertical" />)
    expect(container.querySelector('.space-y-4')).not.toBeNull()
    expect(container.querySelector('.w-full')).toBeNull()
  })

  it('renders descriptions in vertical mode', () => {
    render(<ConversionStepper steps={FLOW} orientation="vertical" />)
    expect(screen.getByText('完了済み')).toBeInTheDocument()
    expect(screen.getByText('実行中')).toBeInTheDocument()
    expect(screen.getByText('失敗')).toBeInTheDocument()
  })

  it('omits the description block for steps that have no description', () => {
    render(<ConversionStepper steps={FLOW} orientation="vertical" />)
    // '変換' carries no description; its text column holds only the label <p>.
    const textCol = screen.getByText('変換').parentElement
    expect(textCol?.querySelectorAll('p')).toHaveLength(1)
  })

  it('renders vertical connector bars between steps only', () => {
    const { container } = render(<ConversionStepper steps={FLOW} orientation="vertical" />)
    // `.h-12` is carried only by vertical connector bars.
    expect(container.querySelectorAll('.h-12')).toHaveLength(3)
  })

  it('colors the vertical connector bg-primary when its step is completed', () => {
    const { container } = render(<ConversionStepper steps={FLOW} orientation="vertical" />)
    const connectors = container.querySelectorAll('.h-12')
    expect(connectors[0].className).toContain('bg-primary')
    expect(connectors[1].className).toContain('bg-muted')
  })

  it('renders no vertical connector for a single step', () => {
    const { container } = render(
      <ConversionStepper
        steps={[step({ id: 'only', label: 'Only', status: 'current' })]}
        orientation="vertical"
      />
    )
    expect(container.querySelectorAll('.h-12')).toHaveLength(0)
  })
})

describe('ConversionStepper — step click navigation', () => {
  it('does not invoke onStepClick by default (allowNavigation defaults to false)', () => {
    const onStepClick = vi.fn()
    render(<ConversionStepper steps={FLOW} onStepClick={onStepClick} />)
    fireEvent.click(screen.getByText('マッピング')) // completed
    expect(onStepClick).not.toHaveBeenCalled()
  })

  it('invokes onStepClick with the id when a completed step is clicked and navigation is allowed', () => {
    const onStepClick = vi.fn()
    render(<ConversionStepper steps={FLOW} onStepClick={onStepClick} allowNavigation />)
    fireEvent.click(screen.getByText('マッピング'))
    expect(onStepClick).toHaveBeenCalledWith('mapping')
    expect(onStepClick).toHaveBeenCalledTimes(1)
  })

  it('ignores clicks on non-completed steps even when navigation is allowed', () => {
    const onStepClick = vi.fn()
    render(<ConversionStepper steps={FLOW} onStepClick={onStepClick} allowNavigation />)
    fireEvent.click(screen.getByText('検証')) // current
    fireEvent.click(screen.getByText('変換')) // pending
    fireEvent.click(screen.getByText('レビュー')) // error
    expect(onStepClick).not.toHaveBeenCalled()
  })

  it('fires only for completed steps when completed and non-completed steps are mixed', () => {
    const onStepClick = vi.fn()
    const steps: Step[] = [
      step({ id: 'done1', label: 'Done1', status: 'completed' }),
      step({ id: 'wip', label: 'Wip', status: 'current' }),
      step({ id: 'done2', label: 'Done2', status: 'completed' }),
    ]
    render(<ConversionStepper steps={steps} onStepClick={onStepClick} allowNavigation />)
    fireEvent.click(screen.getByText('Done1'))
    fireEvent.click(screen.getByText('Wip'))
    fireEvent.click(screen.getByText('Done2'))
    expect(onStepClick.mock.calls).toEqual([['done1'], ['done2']])
  })

  it('does not throw when navigation is allowed but no onStepClick handler is supplied', () => {
    expect(() => {
      render(<ConversionStepper steps={FLOW} allowNavigation />)
      fireEvent.click(screen.getByText('マッピング'))
    }).not.toThrow()
  })

  it('adds the cursor-pointer affordance only to completed steps when navigation is allowed', () => {
    const { container } = render(<ConversionStepper steps={FLOW} allowNavigation />)
    expect(container.querySelectorAll('.cursor-pointer')).toHaveLength(1)
  })

  it('does not add any cursor-pointer affordance when navigation is disabled', () => {
    const { container } = render(<ConversionStepper steps={FLOW} />)
    expect(container.querySelectorAll('.cursor-pointer')).toHaveLength(0)
  })
})

describe('ConversionStepper — vertical navigation', () => {
  it('invokes onStepClick for a completed step in vertical mode', () => {
    const onStepClick = vi.fn()
    render(
      <ConversionStepper
        steps={FLOW}
        onStepClick={onStepClick}
        allowNavigation
        orientation="vertical"
      />
    )
    fireEvent.click(screen.getByText('マッピング'))
    expect(onStepClick).toHaveBeenCalledWith('mapping')
  })

  it('does not navigate in vertical mode when allowNavigation is false', () => {
    const onStepClick = vi.fn()
    render(<ConversionStepper steps={FLOW} onStepClick={onStepClick} orientation="vertical" />)
    fireEvent.click(screen.getByText('マッピング'))
    expect(onStepClick).not.toHaveBeenCalled()
  })

  it('adds exactly one cursor-pointer affordance for the single completed step', () => {
    const { container } = render(
      <ConversionStepper steps={FLOW} allowNavigation orientation="vertical" />
    )
    expect(container.querySelectorAll('.cursor-pointer')).toHaveLength(1)
  })
})

describe('ConversionStepper — fail-safe & boundary cases', () => {
  it('renders without crashing for an empty steps array (horizontal)', () => {
    const { container } = render(<ConversionStepper steps={[]} />)
    expect(circles(container)).toHaveLength(0)
    expect(container.querySelectorAll('.mx-2')).toHaveLength(0)
  })

  it('renders without crashing for an empty steps array (vertical)', () => {
    const { container } = render(<ConversionStepper steps={[]} orientation="vertical" />)
    expect(circles(container)).toHaveLength(0)
    expect(container.querySelectorAll('.h-12')).toHaveLength(0)
  })

  it('renders a single step with no connector and the number 1', () => {
    const { container } = render(
      <ConversionStepper steps={[step({ id: 'solo', label: 'Solo', status: 'current' })]} />
    )
    const list = circles(container)
    expect(list).toHaveLength(1)
    expect(list[0].querySelector('span')?.textContent).toBe('1')
    expect(container.querySelectorAll('.mx-2')).toHaveLength(0)
  })

  it('accepts the full Step shape including optional labelEn / description without breaking', () => {
    const steps: Step[] = [
      step({
        id: 'full',
        label: 'Full',
        labelEn: 'FullStep',
        description: 'desc',
        status: 'completed',
      }),
    ]
    const { container } = render(<ConversionStepper steps={steps} />)
    expect(circles(container)).toHaveLength(1)
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  it('renders a long mixed flow deterministically and navigates only completed steps', () => {
    const steps: Step[] = [
      step({ id: 'a', label: 'A', status: 'completed' }),
      step({ id: 'b', label: 'B', status: 'completed' }),
      step({ id: 'c', label: 'C', status: 'current' }),
      step({ id: 'd', label: 'D', status: 'pending' }),
      step({ id: 'e', label: 'E', status: 'error' }),
    ]
    const onStepClick = vi.fn()
    const { container } = render(
      <ConversionStepper steps={steps} onStepClick={onStepClick} allowNavigation />
    )
    expect(container.querySelectorAll('.cursor-pointer')).toHaveLength(2) // a, b
    expect(container.querySelectorAll('.mx-2')).toHaveLength(4) // between the 5 steps
    fireEvent.click(screen.getByText('A'))
    fireEvent.click(screen.getByText('C'))
    fireEvent.click(screen.getByText('D'))
    fireEvent.click(screen.getByText('E'))
    expect(onStepClick.mock.calls).toEqual([['a']])
    fireEvent.click(screen.getByText('B'))
    expect(onStepClick.mock.calls).toEqual([['a'], ['b']])
  })
})
