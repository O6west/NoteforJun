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
  it('"- "는 체크박스가 되지 않고 하이픈으로 남는다', () => {
    // 줄 앞에 - 를 찍는 것은 항목을 나열하는 흔한 손버릇이다.
    typeText(editor, '- 장보기')
    expect(editor.getHTML()).not.toContain('data-type="taskList"')
    expect(editor.getText()).toBe('- 장보기')
  })

  it('"[] "를 쳐도 체크박스가 된다', () => {
    typeText(editor, '[] 운동')
    expect(editor.getHTML()).toContain('data-type="taskList"')
  })

  it('Enter를 누르면 다음 체크박스가 생기지 않고 목록에서 빠져나온다', () => {
    // 자동으로 만들어 주면 [] 를 칠 일이 없어져 손에 익지 않는다.
    //
    // editor.commands.keyboardShortcut('Enter')는 tiptap의 captureTransaction으로
    // 감싸 실행되는데, 그 안에서 splitListItem과 liftListItem을 각각 실제
    // 트랜잭션으로 디스패치하면 캡처 중인 트랜잭션과 충돌해 에러가 난다.
    // 실제 Enter 키 입력은 그런 캡처 없이 handleKeyDown으로 바로 들어오므로,
    // 여기서도 그 경로로 직접 흘려보내 실제 키 입력을 검증한다.
    typeText(editor, '[] 장보기')
    editor.view.someProp('handleKeyDown', (f) =>
      f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })),
    )
    typeText(editor, '운동')

    const html = editor.getHTML()
    expect(html.match(/data-checked=/g) ?? []).toHaveLength(1)
    expect(html).toContain('<p>운동</p>')
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

describe('저장 신호', () => {
  it('글자를 칠 때마다 알리되, 본문을 직렬화해 넘기지는 않는다', () => {
    // 직렬화는 저장하는 쪽이 저장 직전에 한 번만 한다.
    // 한글은 조합 중에도 자모마다 문서가 바뀌어서 '가' 한 글자에 두 번 불린다.
    // 여기서 매번 getHTML()을 하면 메모가 길어질수록 그 비용이 IME 조합
    // 타이밍을 밀어내고, 글자가 한 박자 늦게 들어간다.
    const calls = []
    const el = document.createElement('div')
    document.body.appendChild(el)
    const ed = createEditor({ element: el, content: '', onUpdate: (...args) => calls.push(args) })

    typeText(ed, '가나다')

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((args) => args.length === 0)).toBe(true)

    ed.destroy()
    el.remove()
  })
})
