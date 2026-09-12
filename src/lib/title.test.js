import { describe, expect, it } from 'vitest'
import { TITLE_MAX, clampTitle } from './title.js'

describe('clampTitle', () => {
  it('최대 길이는 20자다', () => {
    expect(TITLE_MAX).toBe(20)
  })

  it('20자 이하는 그대로 둔다', () => {
    expect(clampTitle('6월 일본여행 계획(오사카)')).toBe('6월 일본여행 계획(오사카)')
  })

  it('20자를 넘으면 잘라낸다', () => {
    const long = '가'.repeat(25)
    expect(clampTitle(long)).toHaveLength(20)
  })

  it('줄바꿈은 공백으로 바꾼다 (붙여넣기 대비)', () => {
    expect(clampTitle('첫줄\n둘째줄')).toBe('첫줄 둘째줄')
  })

  it('앞뒤 공백을 정리한다', () => {
    expect(clampTitle('  제목  ')).toBe('제목')
  })

  it('null이나 undefined는 빈 문자열이 된다', () => {
    expect(clampTitle(null)).toBe('')
    expect(clampTitle(undefined)).toBe('')
  })

  it('한글도 20자까지만 들어간다', () => {
    // 요즘 윈도우 IME는 '한'을 완성형 한 글자(U+D55C)로 준다. 여기까지는 문제없다.
    expect(clampTitle('한'.repeat(30))).toBe('한'.repeat(20))
  })

  it('조합용 낱자로 들어온 한글은 코드 단위로 센다 (현재 동작을 못박아 둔다)', () => {
    // 옛 방식의 조합용 낱자(ᄒ+ᅡ+ᆫ)는 눈에 한 글자로 보이지만 코드 단위로는 셋이라
    // 20자 제한에 더 적게 들어간다. 흔치 않지만 나중에 바뀌면 알아차리도록 적어 둔다.
    const jamo = '한'
    expect(jamo).toHaveLength(3)
    expect(clampTitle(jamo.repeat(10))).toHaveLength(20)
  })
})
