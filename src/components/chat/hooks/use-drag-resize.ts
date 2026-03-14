'use client'

import { useState, useRef, useCallback } from 'react'
import type { ChatWidgetPosition, ChatWidgetSize } from '../types'
import { MIN_WIDGET_SIZE, WIDGET_POSITION_OFFSET } from '../types'

export interface UseDragOptions {
  initialPosition: ChatWidgetPosition
  onPositionChange: (position: ChatWidgetPosition) => void
  boundaryRef?: React.RefObject<HTMLElement | null>
}

export interface UseDragReturn {
  isDragging: boolean
  handleMouseDown: (e: React.MouseEvent) => void
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    style: { cursor: string }
  }
}

export function useDrag({
  initialPosition,
  onPositionChange,
  boundaryRef,
}: UseDragOptions): UseDragReturn {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: initialPosition.x,
        posY: initialPosition.y,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartRef.current) return

        const deltaX = moveEvent.clientX - dragStartRef.current.x
        const deltaY = moveEvent.clientY - dragStartRef.current.y

        let newX = dragStartRef.current.posX + deltaX
        let newY = dragStartRef.current.posY + deltaY

        if (boundaryRef?.current) {
          const boundary = boundaryRef.current.getBoundingClientRect()
          const maxX = boundary.width - MIN_WIDGET_SIZE.width - WIDGET_POSITION_OFFSET
          const maxY = boundary.height - MIN_WIDGET_SIZE.height - WIDGET_POSITION_OFFSET
          newX = Math.max(
            -boundary.width + MIN_WIDGET_SIZE.width + WIDGET_POSITION_OFFSET,
            Math.min(maxX, newX)
          )
          newY = Math.max(
            -boundary.height + MIN_WIDGET_SIZE.height + WIDGET_POSITION_OFFSET,
            Math.min(maxY, newY)
          )
        }

        onPositionChange({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        dragStartRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [initialPosition, onPositionChange, boundaryRef]
  )

  return {
    isDragging,
    handleMouseDown,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      style: { cursor: isDragging ? 'grabbing' : 'grab' },
    },
  }
}

export interface UseResizeOptions {
  initialSize: ChatWidgetSize
  onSizeChange: (size: ChatWidgetSize) => void
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export interface UseResizeReturn {
  isResizing: boolean
  resizeHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void
  }
}

export function useResize({
  initialSize,
  onSizeChange,
  minWidth = MIN_WIDGET_SIZE.width,
  minHeight = MIN_WIDGET_SIZE.height,
  maxWidth = 600,
  maxHeight = 800,
}: UseResizeOptions): UseResizeReturn {
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: initialSize.width,
        height: initialSize.height,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeStartRef.current) return

        const deltaX = moveEvent.clientX - resizeStartRef.current.x
        const deltaY = moveEvent.clientY - resizeStartRef.current.y

        const newWidth = Math.max(
          minWidth,
          Math.min(maxWidth, resizeStartRef.current.width + deltaX)
        )
        const newHeight = Math.max(
          minHeight,
          Math.min(maxHeight, resizeStartRef.current.height + deltaY)
        )

        onSizeChange({ width: newWidth, height: newHeight })
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        resizeStartRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [initialSize, onSizeChange, minWidth, minHeight, maxWidth, maxHeight]
  )

  return {
    isResizing,
    resizeHandleProps: {
      onMouseDown: handleMouseDown,
    },
  }
}
