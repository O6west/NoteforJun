import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createEditor } from './editor.js'

let editor
let element

beforeEach(() => {
  element = document.createElement('div')
  document.body.appendChild(element)
  editor = createEditor({ element, content: '' })
})

afterEach(() => {
  editor.destroy()
  element.remove()
})

describe('큰 글씨', () => {
  it('"# "를 치면 h1이 되고 # 기호는 남지 않는다', () => {
    typeText(editor, '# 이번주 할일')
    const html = editor.getHTML()
    expect(html).toContain('<h1>이번주 할일</h1>')
    expect(html).not.toContain('#')
  })

  it('"## "는 아무 일도 하지 않는다 (헤딩은 1단계뿐)', () => {
    typeText(editor, '## 부제목')
    expect(editor.getHTML()).not.toContain('<h1>')
    expect(editor.getText()).toBe('## 부제목')
  })
})

describe('체크박스', () => {
  it('"- "를 치면 체크박스가 된다', () => {
    typeText(editor, '- 장보기')
    const html = editor.getHTML()
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('장보기')
  })

  it('"[] "를 쳐도 체크박스가 된다', () => {
    typeText(editor, '[] 운동')
    expect(editor.getHTML()).toContain('data-type="taskList"')
  })

  it('Enter를 누르면 다음 항목이 생긴다', () => {
    typeText(editor, '- 장보기')
    editor.commands.splitListItem('taskItem')
    typeText(editor, '운동')
    const items = editor.getHTML().match(/data-checked=/g) ?? []
    expect(items).toHaveLength(2)
  })

  it('빈 항목에서 Enter를 누르면 목록에서 빠져나온다', () => {
    typeText(editor, '- 장보기')
    editor.commands.splitListItem('taskItem')
    editor.commands.liftListItem('taskItem')
    expect(editor.getHTML()).toContain('<p></p>')
  })
})

describe('선택 서식', () => {
  beforeEach(() => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
  })

  it('굵게가 적용되고 해제된다', () => {
    editor.commands.toggleBold()
    expect(editor.getHTML()).toContain('<strong>')
    editor.commands.toggleBold()
    expect(editor.getHTML()).not.toContain('<strong>')
  })

  it('기울임이 적용된다', () => {
    editor.commands.toggleItalic()
    expect(editor.getHTML()).toContain('<em>')
  })

  it('밑줄이 적용된다', () => {
    editor.commands.toggleUnderline()
    expect(editor.getHTML()).toContain('<u>')
  })

  it('형광펜이 적용되고 isActive로 상태를 읽을 수 있다', () => {
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('<mark>')
    expect(editor.isActive('highlight')).toBe(true)
  })
})

describe('지원하지 않는 서식', () => {
  it('글머리표 확장이 없다', () => {
    expect(editor.schema.nodes.bulletList).toBeUndefined()
  })

  it('취소선 확장이 없다', () => {
    expect(editor.schema.marks.strike).toBeUndefined()
  })
})

describe('편집기 설정', () => {
  it('맞춤법 빨간 줄을 끄고 시작한다', () => {
    // 한글에서는 멀쩡한 문장에도 빨간 줄이 잔뜩 그어진다
    expect(editor.view.dom.getAttribute('spellcheck')).toBe('false')
  })
})
