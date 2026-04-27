import { describe, it, expect } from 'vitest'
import { formatMinutes, toMonthString, getLast12Months, formatMonthLabel } from './utils'

describe('formatMinutes', () => {
  it('formats whole hours', () => {
    expect(formatMinutes(480)).toBe('8h')
  })
  it('formats hours and minutes', () => {
    expect(formatMinutes(465)).toBe('7h 45min')
  })
  it('formats zero hours with minutes', () => {
    expect(formatMinutes(30)).toBe('0h 30min')
  })
})

describe('toMonthString', () => {
  it('formats date to YYYY-MM', () => {
    expect(toMonthString(new Date('2026-04-15'))).toBe('2026-04')
  })
})

describe('getLast12Months', () => {
  it('returns 12 months', () => {
    expect(getLast12Months()).toHaveLength(12)
  })
  it('returns YYYY-MM format', () => {
    expect(getLast12Months()[0]).toMatch(/^\d{4}-\d{2}$/)
  })
  it('most recent month is first', () => {
    const months = getLast12Months()
    expect(months[0] > months[1]).toBe(true)
  })
})

describe('formatMonthLabel', () => {
  it('returns Croatian month name', () => {
    expect(formatMonthLabel('2026-04')).toBe('Travanj 2026')
  })
  it('returns correct month for January', () => {
    expect(formatMonthLabel('2026-01')).toBe('Siječanj 2026')
  })
})
