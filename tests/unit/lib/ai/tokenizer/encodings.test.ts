import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getEncodingForModel,
  getTiktokenEncodingName,
  ENCODING_INFO,
  type EncodingName,
} from '@/lib/ai/tokenizer/encodings'

describe('encodings', () => {
  describe('getEncodingForModel', () => {
    it('should return o200k_base for GPT-4o models', () => {
      expect(getEncodingForModel('gpt-4o')).toBe('o200k_base')
      expect(getEncodingForModel('gpt-4o-2024-05-13')).toBe('o200k_base')
      expect(getEncodingForModel('GPT-4O')).toBe('o200k_base')
    })

    it('should return o200k_base for GPT-4o-mini models', () => {
      expect(getEncodingForModel('gpt-4o-mini')).toBe('o200k_base')
      expect(getEncodingForModel('gpt-4o-mini-2024-07-18')).toBe('o200k_base')
    })

    it('should return o200k_base for GPT-5 series', () => {
      expect(getEncodingForModel('gpt-5-nano')).toBe('o200k_base')
      expect(getEncodingForModel('gpt-5')).toBe('o200k_base')
      expect(getEncodingForModel('gpt-5-turbo')).toBe('o200k_base')
    })

    it('should return o200k_base for GPT-4.1 series', () => {
      expect(getEncodingForModel('gpt-4.1')).toBe('o200k_base')
      expect(getEncodingForModel('gpt-4.1-mini')).toBe('o200k_base')
    })

    it('should return cl100k_base for GPT-4 Turbo', () => {
      expect(getEncodingForModel('gpt-4-turbo')).toBe('cl100k_base')
      expect(getEncodingForModel('gpt-4-turbo-2024-04-09')).toBe('cl100k_base')
    })

    it('should return cl100k_base for GPT-4 base models', () => {
      expect(getEncodingForModel('gpt-4')).toBe('cl100k_base')
      expect(getEncodingForModel('gpt-4-0613')).toBe('cl100k_base')
    })

    it('should return cl100k_base for GPT-3.5 Turbo', () => {
      expect(getEncodingForModel('gpt-3.5-turbo')).toBe('cl100k_base')
      expect(getEncodingForModel('gpt-3.5-turbo-16k')).toBe('cl100k_base')
    })

    it('should return cl100k_base for Claude models (approximate)', () => {
      expect(getEncodingForModel('claude-3-opus')).toBe('cl100k_base')
      expect(getEncodingForModel('claude-3-5-sonnet-20241022')).toBe('cl100k_base')
      expect(getEncodingForModel('claude-sonnet-4-20250514')).toBe('cl100k_base')
    })

    it('should return cl100k_base for Gemini models (approximate)', () => {
      expect(getEncodingForModel('gemini-2.0-flash')).toBe('cl100k_base')
      expect(getEncodingForModel('gemini-1.5-pro')).toBe('cl100k_base')
    })

    it('should return cl100k_base as fallback for unknown models', () => {
      expect(getEncodingForModel('unknown-model')).toBe('cl100k_base')
      expect(getEncodingForModel('custom-model-v1')).toBe('cl100k_base')
    })

    it('should handle whitespace in model names', () => {
      expect(getEncodingForModel('  gpt-4o  ')).toBe('o200k_base')
    })
  })

  describe('getTiktokenEncodingName', () => {
    it('should return correct tiktoken name for cl100k_base', () => {
      expect(getTiktokenEncodingName('cl100k_base')).toBe('cl100k_base')
    })

    it('should return correct tiktoken name for o200k_base', () => {
      expect(getTiktokenEncodingName('o200k_base')).toBe('o200k_base')
    })
  })

  describe('ENCODING_INFO', () => {
    it('should have info for cl100k_base', () => {
      expect(ENCODING_INFO['cl100k_base']).toBeDefined()
      expect(ENCODING_INFO['cl100k_base'].name).toBe('cl100k_base')
      expect(ENCODING_INFO['cl100k_base'].tiktokenName).toBe('cl100k_base')
    })

    it('should have info for o200k_base', () => {
      expect(ENCODING_INFO['o200k_base']).toBeDefined()
      expect(ENCODING_INFO['o200k_base'].name).toBe('o200k_base')
      expect(ENCODING_INFO['o200k_base'].tiktokenName).toBe('o200k_base')
    })
  })
})
