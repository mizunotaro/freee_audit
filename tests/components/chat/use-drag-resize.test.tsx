import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDrag, useResize } from '@/components/chat/hooks'
import { MIN_WIDGET_SIZE, WIDGET_POSITION_OFFSET } from '@/components/chat/types'

function mouseEvent(clientX: number, clientY: number) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX,
    clientY,
  } as unknown as React.MouseEvent
}

function dispatchDoc(type: 'mousemove' | 'mouseup', clientX: number, clientY: number) {
  document.dispatchEvent(new MouseEvent(type, { clientX, clientY }))
}

describe('chat/use-drag-resize — useDrag', () => {
  it('starts not dragging with a grab cursor', () => {
    const { result } = renderHook(() =>
      useDrag({ initialPosition: { x: 10, y: 20 }, onPositionChange: vi.fn() })
    )
    expect(result.current.isDragging).toBe(false)
    expect(result.current.dragHandleProps.style.cursor).toBe('grab')
  })

  it('moves by the mouse delta from the start point (no boundary)', () => {
    const onPositionChange = vi.fn()
    const { result } = renderHook(() =>
      useDrag({ initialPosition: { x: 100, y: 50 }, onPositionChange })
    )

    act(() => {
      result.current.dragHandleProps.onMouseDown(mouseEvent(0, 0))
    })
    expect(result.current.isDragging).toBe(true)
    expect(result.current.dragHandleProps.style.cursor).toBe('grabbing')

    act(() => dispatchDoc('mousemove', 30, -10))

    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 130, y: 40 })

    act(() => dispatchDoc('mouseup', 30, -10))
    expect(result.current.isDragging).toBe(false)
    expect(result.current.dragHandleProps.style.cursor).toBe('grab')
  })

  it('clamps the position inside a provided boundary envelope', () => {
    const onPositionChange = vi.fn()
    const boundary = document.createElement('div')
    const width = 1000
    const height = 800
    vi.spyOn(boundary, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      toJSON: () => ({}),
    })

    const { result } = renderHook(() =>
      useDrag({
        initialPosition: { x: 0, y: 0 },
        onPositionChange,
        boundaryRef: { current: boundary },
      })
    )

    const maxX = width - MIN_WIDGET_SIZE.width - WIDGET_POSITION_OFFSET
    const maxY = height - MIN_WIDGET_SIZE.height - WIDGET_POSITION_OFFSET
    const minX = -width + MIN_WIDGET_SIZE.width + WIDGET_POSITION_OFFSET
    const minY = -height + MIN_WIDGET_SIZE.height + WIDGET_POSITION_OFFSET

    act(() => {
      result.current.dragHandleProps.onMouseDown(mouseEvent(0, 0))
    })

    act(() => dispatchDoc('mousemove', 5000, 0))
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: maxX, y: 0 })

    act(() => dispatchDoc('mousemove', -5000, 0))
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: minX, y: 0 })

    act(() => dispatchDoc('mousemove', 0, 5000))
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 0, y: maxY })

    act(() => dispatchDoc('mousemove', 0, -5000))
    expect(onPositionChange).toHaveBeenLastCalledWith({ x: 0, y: minY })

    act(() => dispatchDoc('mouseup', 0, 0))
  })

  it('stops tracking after mouseup (later moves do not fire callbacks)', () => {
    const onPositionChange = vi.fn()
    const { result } = renderHook(() =>
      useDrag({ initialPosition: { x: 0, y: 0 }, onPositionChange })
    )

    act(() => result.current.dragHandleProps.onMouseDown(mouseEvent(0, 0)))
    act(() => dispatchDoc('mousemove', 5, 5))
    const callsBefore = onPositionChange.mock.calls.length

    act(() => dispatchDoc('mouseup', 5, 5))
    act(() => dispatchDoc('mousemove', 999, 999))

    expect(onPositionChange.mock.calls.length).toBe(callsBefore)
  })
})

describe('chat/use-drag-resize — useResize', () => {
  it('starts not resizing and exposes a mousedown handler', () => {
    const { result } = renderHook(() =>
      useResize({ initialSize: { width: 380, height: 500 }, onSizeChange: vi.fn() })
    )
    expect(result.current.isResizing).toBe(false)
    expect(typeof result.current.resizeHandleProps.onMouseDown).toBe('function')
  })

  it('grows by the mouse delta from the start size', () => {
    const onSizeChange = vi.fn()
    const { result } = renderHook(() =>
      useResize({ initialSize: { width: 380, height: 500 }, onSizeChange })
    )

    act(() => result.current.resizeHandleProps.onMouseDown(mouseEvent(0, 0)))
    expect(result.current.isResizing).toBe(true)

    act(() => dispatchDoc('mousemove', 20, 40))
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 400, height: 540 })

    act(() => dispatchDoc('mouseup', 20, 40))
    expect(result.current.isResizing).toBe(false)
  })

  it('clamps upward growth at the default max (600x800)', () => {
    const onSizeChange = vi.fn()
    const { result } = renderHook(() =>
      useResize({ initialSize: { width: 380, height: 500 }, onSizeChange })
    )

    act(() => result.current.resizeHandleProps.onMouseDown(mouseEvent(0, 0)))
    act(() => dispatchDoc('mousemove', 5000, 5000))
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 600, height: 800 })
    act(() => dispatchDoc('mouseup', 5000, 5000))
  })

  it('clamps downward shrink at the default min (300x400)', () => {
    const onSizeChange = vi.fn()
    const { result } = renderHook(() =>
      useResize({ initialSize: { width: 380, height: 500 }, onSizeChange })
    )

    act(() => result.current.resizeHandleProps.onMouseDown(mouseEvent(0, 0)))
    act(() => dispatchDoc('mousemove', -5000, -5000))
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 300, height: 400 })
    act(() => dispatchDoc('mouseup', -5000, -5000))
  })

  it('honours custom min/max overrides when provided', () => {
    const onSizeChange = vi.fn()
    const { result } = renderHook(() =>
      useResize({
        initialSize: { width: 200, height: 200 },
        onSizeChange,
        minWidth: 150,
        minHeight: 150,
        maxWidth: 250,
        maxHeight: 250,
      })
    )

    act(() => result.current.resizeHandleProps.onMouseDown(mouseEvent(0, 0)))
    act(() => dispatchDoc('mousemove', 1000, 1000))
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 250, height: 250 })
    act(() => dispatchDoc('mousemove', -1000, -1000))
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 150, height: 150 })
    act(() => dispatchDoc('mouseup', -1000, -1000))
  })
})
