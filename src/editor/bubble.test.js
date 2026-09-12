import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createBubble } from './bubble.js'
import { createEditor } from './editor.js'

let editor
let element
let container
let bubble

beforeEach(() => {
  container = document.createElement('div')
  element = document.createElement('div')
  container.appendChild(element)
  document.body.appendChild(container)
  editor = createEditor({ element, content: '' })
  bubble = createBubble({ editor, container })
})

afterEach(() => {
  bubble.destroy()
  editor.destroy()
  container.remove()
})

describe('드래그 팝업', () => {
  it('버튼이 네 개다 (B I U 형광펜)', () => {
    const keys = [...bubble.element.querySelectorAll('button')].map((b) => b.dataset.mark)
    expect(keys).toEqual(['bold', 'italic', 'underline', 'highlight'])
  })

  it('선택이 없으면 숨어 있다', () => {
    bubble.update()
    expect(bubble.element.hidden).toBe(true)
  })

  it('글자를 선택하면 나타난다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.update()
    expect(bubble.element.hidden).toBe(false)
  })

  it('버튼을 누르면 서식이 적용된다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.element.querySelector('[data-mark="highlight"]').click()
    expect(editor.getHTML()).toContain('<mark>')
  })

  it('이미 적용된 서식은 눌린 상태로 보인다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    editor.commands.toggleBold()
    bubble.update()
    const boldBtn = bubble.element.querySelector('[data-mark="bold"]')
    expect(boldBtn.getAttribute('aria-pressed')).toBe('true')
    expect(bubble.element.querySelector('[data-mark="italic"]').getAttribute('aria-pressed')).toBe('false')
  })

  it('같은 버튼을 다시 누르면 해제된다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    const btn = bubble.element.querySelector('[data-mark="bold"]')
    btn.click()
    expect(editor.getHTML()).toContain('<strong>')
    editor.commands.selectAll()
    btn.click()
    expect(editor.getHTML()).not.toContain('<strong>')
  })

  it('버튼을 누를 때 선택이 풀리지 않도록 mousedown을 막는다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.update()

    // 이 방어가 없으면 마우스를 누르는 순간 선택이 사라져서
    // 클릭 처리가 실행될 때는 서식을 걸 대상이 이미 없다.
    for (const btn of bubble.element.querySelectorAll('button')) {
      const event = new MouseEvent('mousedown', { cancelable: true, bubbles: true })
      btn.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })
})
