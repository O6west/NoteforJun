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

  it('네 가지를 알려준다', () => {
    const keys = [...help.element.querySelectorAll('kbd')].map((k) => k.textContent)
    expect(keys).toEqual(['[]', '#', 'Ctrl+B I U', 'Ctrl+Alt+N'])
  })

  it('결과를 설명하지 않고 그 모양으로 보여준다', () => {
    // "굵게"를 굵게 써두면 무엇이 되는지 읽지 않아도 보인다.
    // 이 표시가 빠지면 안내는 다시 외워야 할 목록이 된다.
    const shape = (cls) => help.element.querySelector(`.${cls}`)?.textContent
    expect(shape('as-h1')).toBe('제목')
    expect(shape('as-bold')).toBe('굵게')
    expect(shape('as-italic')).toBe('기울임')
    expect(shape('as-underline')).toBe('밑줄')
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
