import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHelp } from './help.js'

let container
let button
let help

beforeEach(() => {
  container = document.createElement('div')
  button = document.createElement('button')
  container.appendChild(button)
  document.body.appendChild(container)
  help = createHelp({ button, container })
})

afterEach(() => {
  help.destroy()
  container.remove()
})

describe('도움말', () => {
  it('처음에는 숨어 있다', () => {
    expect(help.element.hidden).toBe(true)
  })

  it('다섯 가지를 알려준다', () => {
    const keys = [...help.element.querySelectorAll('kbd')].map((k) => k.textContent)
    expect(keys).toEqual([
      '[] 또는 - 다음 스페이스',
      '# 다음 스페이스',
      'Ctrl+B / I / U',
      '글자를 끌면',
      'Ctrl+Alt+N',
    ])
  })

  it('실제로 되는 것만 적혀 있다', () => {
    // rules.js의 TASK_INPUT_RULE이 "[] "와 "- " 둘 다 받는다.
    // 안내에 하나만 적으면 반쪽짜리 문서가 된다.
    const text = help.element.textContent
    expect(text).toContain('[]')
    expect(text).toContain('-')
    expect(text).toContain('할 일')
  })

  it('커서를 올리면 나타나고 치우면 사라진다', () => {
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(help.element.hidden).toBe(false)

    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(help.element.hidden).toBe(true)
  })

  it('Tab으로 초점이 닿아도 나타난다', () => {
    // 이 앱은 제목 → 본문 → 서식 팝업을 Tab으로 잇는다.
    // ?만 마우스 전용이면 그 흐름이 여기서 끊긴다.
    button.dispatchEvent(new FocusEvent('focus'))
    expect(help.element.hidden).toBe(false)

    button.dispatchEvent(new FocusEvent('blur'))
    expect(help.element.hidden).toBe(true)
  })

  it('destroy하면 팝업이 사라진다', () => {
    help.destroy()
    expect(container.querySelector('#help')).toBeNull()
    help = createHelp({ button, container }) // afterEach가 다시 destroy할 수 있게
  })
})
