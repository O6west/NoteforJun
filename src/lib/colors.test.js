import { describe, expect, it } from 'vitest'
import { COLORS, DEFAULT_COLOR, colorOf } from './colors.js'

describe('COLORS', () => {
  it('정확히 6가지다', () => {
    expect(COLORS).toHaveLength(6)
  })

  it('설계 문서의 값과 정확히 일치한다', () => {
    expect(COLORS).toEqual([
      { key: 'yellow', bar: '#E0B84D', fg: '#3D2F10' },
      { key: 'green', bar: '#7FA86B', fg: '#FFFFFF' },
      { key: 'purple', bar: '#A98BC4', fg: '#FFFFFF' },
      { key: 'blue', bar: '#6FA3BF', fg: '#FFFFFF' },
      { key: 'orange', bar: '#D98C6A', fg: '#FFFFFF' },
      { key: 'gray', bar: '#9A9A94', fg: '#FFFFFF' },
    ])
  })

  it('기본색은 노랑이다', () => {
    expect(DEFAULT_COLOR).toBe('yellow')
  })

  it('모르는 key는 기본색으로 되돌린다', () => {
    expect(colorOf('없는색').key).toBe('yellow')
    expect(colorOf('blue').bar).toBe('#6FA3BF')
  })
})
