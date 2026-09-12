import { describe, expect, it } from 'vitest'
import { filterNotes } from './search.js'

const NOTES = [
  { id: '1', title: '이번주 할일', text: '장보기\n운동' },
  { id: '2', title: '외주 아이디어', text: '사용자가 고를 게 없어야 한다' },
  { id: '3', title: '', text: 'Project Alpha Q3' },
]

describe('filterNotes', () => {
  it('검색어가 비면 전부 돌려준다', () => {
    expect(filterNotes(NOTES, '')).toHaveLength(3)
    expect(filterNotes(NOTES, '   ')).toHaveLength(3)
  })

  it('제목에서 찾는다', () => {
    expect(filterNotes(NOTES, '외주').map((n) => n.id)).toEqual(['2'])
  })

  it('본문에서도 찾는다', () => {
    expect(filterNotes(NOTES, '장보기').map((n) => n.id)).toEqual(['1'])
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(filterNotes(NOTES, 'project').map((n) => n.id)).toEqual(['3'])
    expect(filterNotes(NOTES, 'ALPHA').map((n) => n.id)).toEqual(['3'])
  })

  it('맞는 게 없으면 빈 배열이다', () => {
    expect(filterNotes(NOTES, '존재하지않는단어')).toEqual([])
  })

  it('초성 검색은 지원하지 않는다', () => {
    expect(filterNotes(NOTES, 'ㅇㅈ')).toEqual([])
  })
})
