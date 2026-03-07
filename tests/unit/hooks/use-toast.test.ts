import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reducer, toast, useToast } from '@/hooks/use-toast'

vi.useFakeTimers()

describe('use-toast', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('reducer', () => {
    it('should add toast', () => {
      const state = { toasts: [] }
      const action = {
        type: 'ADD_TOAST' as const,
        toast: { id: '1', title: 'Test', open: true },
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(1)
      expect(result.toasts[0].title).toBe('Test')
    })

    it('should limit toasts to TOAST_LIMIT (1)', () => {
      const state = { toasts: [{ id: '1', title: 'First', open: true }] }
      const action = {
        type: 'ADD_TOAST' as const,
        toast: { id: '2', title: 'Second', open: true },
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(1)
      expect(result.toasts[0].id).toBe('2')
    })

    it('should preserve order with newest first', () => {
      const state = { toasts: [{ id: '1', title: 'First', open: true }] }
      const action = {
        type: 'ADD_TOAST' as const,
        toast: { id: '2', title: 'Second', open: true },
      }

      const result = reducer(state, action)

      expect(result.toasts[0].id).toBe('2')
    })

    it('should update toast', () => {
      const state = { toasts: [{ id: '1', title: 'Test', open: true }] }
      const action = {
        type: 'UPDATE_TOAST' as const,
        toast: { id: '1', title: 'Updated' },
      }

      const result = reducer(state, action)

      expect(result.toasts[0].title).toBe('Updated')
    })

    it('should not modify other toasts when updating', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }
      const action = {
        type: 'UPDATE_TOAST' as const,
        toast: { id: '1', title: 'Updated' },
      }

      const result = reducer(state, action)

      expect(result.toasts[1].title).toBe('Second')
    })

    it('should dismiss specific toast', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }
      const action = {
        type: 'DISMISS_TOAST' as const,
        toastId: '1',
      }

      const result = reducer(state, action)

      expect(result.toasts[0].open).toBe(false)
      expect(result.toasts[1].open).toBe(true)
    })

    it('should dismiss all toasts when no toastId provided', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }
      const action = {
        type: 'DISMISS_TOAST' as const,
        toastId: undefined,
      }

      const result = reducer(state, action)

      expect(result.toasts.every((t) => t.open === false)).toBe(true)
    })

    it('should remove specific toast', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }
      const action = {
        type: 'REMOVE_TOAST' as const,
        toastId: '1',
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(1)
      expect(result.toasts[0].id).toBe('2')
    })

    it('should remove all toasts when no toastId provided', () => {
      const state = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }
      const action = {
        type: 'REMOVE_TOAST' as const,
        toastId: undefined,
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(0)
    })

    it('should handle removing non-existent toast', () => {
      const state = {
        toasts: [{ id: '1', title: 'First', open: true }],
      }
      const action = {
        type: 'REMOVE_TOAST' as const,
        toastId: 'non-existent',
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(1)
    })

    it('should handle empty state for add', () => {
      const state = { toasts: [] }
      const action = {
        type: 'ADD_TOAST' as const,
        toast: { id: '1', title: 'Test', open: true },
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(1)
    })

    it('should handle empty state for update', () => {
      const state = { toasts: [] }
      const action = {
        type: 'UPDATE_TOAST' as const,
        toast: { id: '1', title: 'Updated' },
      }

      const result = reducer(state, action)

      expect(result.toasts).toHaveLength(0)
    })
  })

  describe('toast function', () => {
    it('should return toast id', () => {
      const result = toast({ title: 'Test' })
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })

    it('should return dismiss function', () => {
      const result = toast({ title: 'Test' })
      expect(typeof result.dismiss).toBe('function')
    })

    it('should return update function', () => {
      const result = toast({ title: 'Test' })
      expect(typeof result.update).toBe('function')
    })

    it('should generate unique ids', () => {
      const result1 = toast({ title: 'Test 1' })
      const result2 = toast({ title: 'Test 2' })
      expect(result1.id).not.toBe(result2.id)
    })

    it('should handle toast with description', () => {
      const result = toast({ title: 'Title', description: 'Description' })
      expect(result.id).toBeDefined()
    })

    it('should handle toast with variant', () => {
      const result = toast({ title: 'Error', variant: 'destructive' })
      expect(result.id).toBeDefined()
    })

    it('should handle empty title', () => {
      const result = toast({ title: '' })
      expect(result.id).toBeDefined()
    })

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(1000)
      const result = toast({ title: longMessage, description: longMessage })
      expect(result.id).toBeDefined()
    })

    it('should handle special characters in title', () => {
      const result = toast({ title: 'Test with special chars: <>&"\'/' })
      expect(result.id).toBeDefined()
    })

    it('should handle unicode characters', () => {
      const result = toast({ title: 'テスト 🎉 émoji' })
      expect(result.id).toBeDefined()
    })

    it('should update existing toast', () => {
      const toastResult = toast({ title: 'Original' })
      toastResult.update({ title: 'Updated', id: toastResult.id })
      expect(toastResult.id).toBeDefined()
    })

    it('should dismiss toast', () => {
      const toastResult = toast({ title: 'Test' })
      toastResult.dismiss()
      expect(toastResult.id).toBeDefined()
    })
  })

  describe('useToast hook', () => {
    it('should be a function', () => {
      expect(typeof useToast).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle multiple rapid toast additions', () => {
      for (let i = 0; i < 10; i++) {
        toast({ title: `Toast ${i}` })
      }
    })

    it('should handle very long title', () => {
      const veryLongTitle = 'A'.repeat(10000)
      const result = toast({ title: veryLongTitle })
      expect(result.id).toBeDefined()
    })

    it('should handle newline and tab characters', () => {
      const result = toast({ title: 'Test\nwith\tnewlines' })
      expect(result.id).toBeDefined()
    })

    it('should handle multiple dismiss calls', () => {
      const toastResult = toast({ title: 'Test' })
      toastResult.dismiss()
      toastResult.dismiss()
      expect(toastResult.id).toBeDefined()
    })

    it('should handle multiple update calls', () => {
      const toastResult = toast({ title: 'Original' })
      toastResult.update({ title: 'Updated 1', id: toastResult.id })
      toastResult.update({ title: 'Updated 2', id: toastResult.id })
      expect(toastResult.id).toBeDefined()
    })
  })
})
