import { describe, expect, it } from 'vitest'
import { TASK_INPUT_RULE } from './rules.js'

describe('TASK_INPUT_RULE', () => {
  it('하이픈 + 공백에는 반응하지 않는다', () => {
    expect('- ').not.toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 쌍 + 공백에 반응한다', () => {
    expect('[] ').toMatch(TASK_INPUT_RULE)
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
