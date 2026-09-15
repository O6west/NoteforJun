import { describe, expect, it } from 'vitest'
import { TASK_INPUT_RULE } from './rules.js'

describe('TASK_INPUT_RULE', () => {
  it('하이픈 + 공백에는 반응하지 않는다', () => {
    expect('- ').not.toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 쌍 + 공백에 반응한다', () => {
    expect('[] ').toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 사이를 띄워도 반응한다', () => {
    // 마크다운의 `- [ ]` 습관 때문에 띄어 치는 사람이 많다.
    // 같은 기호를 띄웠다고 실패시킬 이유가 없다.
    expect('[ ] ').toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 사이에 두 칸 이상은 받지 않는다', () => {
    // 여기까지 받아주면 무엇이 규칙인지 흐려진다.
    expect('[  ] ').not.toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 안에 글자가 있으면 반응하지 않는다', () => {
    expect('[x] ').not.toMatch(TASK_INPUT_RULE)
  })

  it('공백 없이는 반응하지 않는다', () => {
    expect('-').not.toMatch(TASK_INPUT_RULE)
    expect('[]').not.toMatch(TASK_INPUT_RULE)
  })

  it('줄 중간의 하이픈에는 반응하지 않는다', () => {
    expect('가- ').not.toMatch(TASK_INPUT_RULE)
  })

  it('별표나 플러스에는 반응하지 않는다 (글머리표는 지원하지 않는다)', () => {
    expect('* ').not.toMatch(TASK_INPUT_RULE)
    expect('+ ').not.toMatch(TASK_INPUT_RULE)
  })
})
