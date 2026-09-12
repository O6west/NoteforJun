import { describe, expect, it } from 'vitest'
import { firstLine, previewText } from './preview.js'

describe('firstLine', () => {
  it('첫 줄만 돌려준다', () => {
    expect(firstLine('장보기\n운동\n세탁')).toBe('장보기')
  })

  it('빈 앞줄은 건너뛴다', () => {
    expect(firstLine('\n\n실제 첫 줄')).toBe('실제 첫 줄')
  })

  it('내용이 없으면 빈 문자열이다', () => {
    expect(firstLine('')).toBe('')
    expect(firstLine('\n\n')).toBe('')
    expect(firstLine(null)).toBe('')
  })
})

describe('previewText', () => {
  it('줄바꿈을 가운뎃점으로 잇는다', () => {
    expect(previewText('장보기\n운동')).toBe('장보기 · 운동')
  })

  it('길면 잘라내고 말줄임을 붙인다', () => {
    expect(previewText('가'.repeat(100), 10)).toBe(`${'가'.repeat(10)}…`)
  })

  it('짧으면 말줄임을 붙이지 않는다', () => {
    expect(previewText('짧다', 10)).toBe('짧다')
  })

  it('빈 내용은 빈 문자열이다', () => {
    expect(previewText('')).toBe('')
    expect(previewText(null)).toBe('')
  })
})
