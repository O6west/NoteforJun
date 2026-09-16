import { describe, expect, it } from 'vitest'
import { ARROW_INPUT_RULE, TASK_INPUT_RULE } from './rules.js'

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

describe('ARROW_INPUT_RULE', () => {
  it('화살표를 만든다', () => {
    expect('->').toMatch(ARROW_INPUT_RULE)
  })

  it('글자 뒤에 이어 쳐도 반응한다', () => {
    // 화살표는 문장 가운데에 쓰는 기호다. 줄 앞에서만 되면 쓸 데가 없다.
    // 규칙이 보는 것은 줄 전체가 아니라 커서까지의 글자다.
    expect('서울->').toMatch(ARROW_INPUT_RULE)
  })

  it('하이픈 하나에는 반응하지 않는다', () => {
    // 항목을 나열하려고 찍은 - 가 화살표가 되면 안 된다.
    expect('-').not.toMatch(ARROW_INPUT_RULE)
    expect('- ').not.toMatch(ARROW_INPUT_RULE)
  })

  it('다 친 뒤에야 반응한다', () => {
    // 규칙이 끝($)에 걸려 있어야 치는 도중에 튀어나오지 않는다.
    expect('-> ').not.toMatch(ARROW_INPUT_RULE)
    expect('->x').not.toMatch(ARROW_INPUT_RULE)
  })

  it('체크박스 규칙과 겹치지 않는다', () => {
    expect('[] ').not.toMatch(ARROW_INPUT_RULE)
    expect('->').not.toMatch(TASK_INPUT_RULE)
  })
})
