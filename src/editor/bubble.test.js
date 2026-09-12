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

describe('키보드로 쓰기', () => {
  beforeEach(() => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.update()
  })

  it('버튼이 Tab으로 닿을 수 있는 진짜 버튼이다', () => {
    for (const btn of bubble.element.querySelectorAll('button')) {
      expect(btn.tagName).toBe('BUTTON')
      expect(btn.disabled).toBe(false)
      // tabindex를 -1로 박아두면 Tab 순서에서 빠진다
      expect(btn.getAttribute('tabindex')).toBeNull()
    }
  })

  it('버튼마다 읽을 수 있는 이름이 있다', () => {
    const names = [...bubble.element.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(names).toEqual(['굵게 (Ctrl+B)', '기울임 (Ctrl+I)', '밑줄 (Ctrl+U)', '형광펜'])
  })

  it('팝업 버튼으로 초점이 옮겨가는 중에는 사라지지 않는다', async () => {
    bubble.element.querySelector('[data-mark="bold"]').focus()
    editor.emit('blur', { editor, event: new FocusEvent('blur') })
    await new Promise((r) => setTimeout(r, 0))

    expect(bubble.element.hidden).toBe(false)
  })

  it('초점이 팝업 밖으로 나가면 사라진다', async () => {
    editor.emit('blur', { editor, event: new FocusEvent('blur') })
    await new Promise((r) => setTimeout(r, 0))

    expect(bubble.element.hidden).toBe(true)
  })

  it('Esc를 누르면 팝업이 닫힌다', () => {
    const btn = bubble.element.querySelector('[data-mark="highlight"]')
    btn.focus()
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(bubble.element.hidden).toBe(true)
  })
})
