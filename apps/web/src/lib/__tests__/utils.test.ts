import { cn } from '../utils'

describe('utils', () => {
  describe('cn (class names)', () => {
    it('merges class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
      expect(cn('foo', undefined, 'bar')).toBe('foo bar')
      expect(cn('foo', null, 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
      const isActive = true
      const isDisabled = false
      
      expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
    })

    it('overrides tailwind classes correctly', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
      expect(cn('p-4', 'p-6')).toBe('p-6')
    })

    it('handles arrays of classes', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
    })

    it('handles empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(undefined)).toBe('')
    })
  })
})