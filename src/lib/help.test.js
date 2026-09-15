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

  it('세 가지를 알려준다', () => {
    const keys = [...help.element.querySelectorAll('kbd')].map((k) => k.textContent)
    expect(keys).toEqual(['[]', '#', 'Ctrl+Alt+N'])
  })

  it('[] 사이에 공백을 넣지 않는다', () => {
    // 붙어 보이는 것은 CSS 자간으로 벌린다. 여기에 진짜 공백을 넣으면
    // "[ ] " 를 따라 친 사람은 체크박스를 못 만든다 — 입력 규칙이 안 맞는다.
    const brackets = help.element.querySelector('kbd').textContent
    expect(brackets).toBe('[]')
    expect(brackets).not.toContain(' ')
  })

  it('이미 아는 단축키는 적지 않는다', () => {
    // Ctrl+B·I·U는 모든 프로그램에서 똑같이 동작하는 공용 지식이다.
    // 아는 것을 적어두면 안내가 길어지고 "외워야 할 목록"처럼 보인다.
    expect(help.element.textContent).not.toContain('Ctrl+B')
  })

  it('결과를 설명하지 않고 그 모양으로 보여준다', () => {
    // "제목"을 크게 써두면 무엇이 되는지 읽지 않아도 보인다.
    // 이 표시가 빠지면 안내는 다시 외워야 할 목록이 된다.
    expect(help.element.querySelector('.as-h1')?.textContent).toBe('제목')
  })

  it('실제로 되는 것만 적혀 있다', () => {
    // rules.js의 TASK_INPUT_RULE은 이제 "[] "만 받는다.
    // 안내에 - 가 남아 있으면 거짓을 알려주는 셈이다.
    const text = help.element.textContent
    expect(text).toContain('[]')
    expect(text).toContain('할 일')
    expect(text).not.toContain('-')
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

  it('메뉴가 열려 있으면 뜨지 않는다', () => {
    // ⋯ 메뉴와 도움말은 상단바 바로 아래 같은 자리를 쓴다. 도움말이 위층이라
    // 그냥 두면 방금 눌러서 연 메뉴를 통째로 덮어, 메뉴가 사라진 것처럼 보인다.
    const menu = document.createElement('div')
    menu.hidden = false
    container.appendChild(menu)
    help.destroy()
    help = createHelp({ button, container, menu })

    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(help.element.hidden).toBe(true)

    menu.hidden = true
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(help.element.hidden).toBe(false)
  })
})
