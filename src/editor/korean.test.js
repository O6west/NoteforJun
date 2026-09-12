import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createEditor } from './editor.js'

let editor
let element

/**
 * 한글 조합 입력을 흉내낸다.
 *
 * 솔직히 말해 이것은 진짜 IME가 아니다. jsdom에는 IME가 없어서, 브라우저가
 * 조합 중에 DOM을 고쳐 쓰는 단계는 재현할 수 없다. 여기서 실제로 검증하는 것은
 * "조합 이벤트가 오가는 동안 편집기가 글자를 잃거나 구조를 망가뜨리지 않는가"다.
 * 조합 중 글자가 화면에 어떻게 그려지는지, 커서가 튀지 않는지는 사람이 봐야 하며
 * 그 항목들은 Task 10 수동 체크리스트에 있다.
 */
function compose(ed, steps, final) {
  const { view } = ed
  view.dom.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
  for (const s of steps) {
    view.dom.dispatchEvent(new CompositionEvent('compositionupdate', { data: s }))
  }
  view.dom.dispatchEvent(new CompositionEvent('compositionend', { data: final }))
  const { from, to } = view.state.selection
  view.dispatch(view.state.tr.insertText(final, from, to))
}

/** '한글' 두 글자를 자모 단계까지 흉내내어 친다 */
function typeHangul(ed) {
  compose(ed, ['ㅎ', '하', '한'], '한')
  compose(ed, ['ㄱ', '그', '글'], '글')
}

beforeEach(() => {
  element = document.createElement('div')
  document.body.appendChild(element)
  editor = createEditor({ element, content: '' })
})

afterEach(() => {
  editor.destroy()
  element.remove()
})

describe('한글 조합 입력', () => {
  it('조합이 끝나면 완성된 글자가 남는다', () => {
    typeHangul(editor)
    expect(editor.getText()).toBe('한글')
  })

  it('조합을 반복해도 앞 글자가 지워지지 않는다', () => {
    for (const s of ['가', '나', '다', '라', '마']) {
      compose(editor, [s], s)
    }
    expect(editor.getText()).toBe('가나다라마')
  })

  it('한글과 영문·숫자를 섞어도 순서가 보존된다', () => {
    typeText(editor, 'A')
    compose(editor, ['ㄱ', '가'], '가')
    typeText(editor, '1')
    compose(editor, ['ㄴ', '나'], '나')
    expect(editor.getText()).toBe('A가1나')
  })
})

describe('한글과 서식', () => {
  it('큰 글씨 안에서 한글을 쳐도 큰 글씨가 유지된다', () => {
    typeText(editor, '# ')
    typeHangul(editor)
    expect(editor.getHTML()).toContain('<h1>한글</h1>')
  })

  it('체크박스 안에서 한글을 쳐도 체크박스가 유지된다', () => {
    typeText(editor, '- ')
    typeHangul(editor)
    const html = editor.getHTML()
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('한글')
  })

  it('체크박스에서 Enter를 눌러도 앞 항목의 한글이 남는다', () => {
    typeText(editor, '- ')
    typeHangul(editor)
    editor.commands.splitListItem('taskItem')
    compose(editor, ['ㄷ', '두'], '두')
    const text = editor.getText()
    expect(text).toContain('한글')
    expect(text).toContain('두')
  })

  it('한글에 굵게가 적용된다', () => {
    typeHangul(editor)
    editor.commands.selectAll()
    editor.commands.toggleBold()
    expect(editor.getHTML()).toContain('<strong>한글</strong>')
  })

  it('한글에 형광펜이 적용된다', () => {
    typeHangul(editor)
    editor.commands.selectAll()
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('<mark>한글</mark>')
  })

  it('한글 일부에만 서식을 걸 수 있다', () => {
    compose(editor, ['ㄱ', '가'], '가')
    compose(editor, ['ㄴ', '나'], '나')
    compose(editor, ['ㄷ', '다'], '다')
    // '나'만 선택 — 문서 시작이 1이므로 2~3이 두 번째 글자다
    editor.commands.setTextSelection({ from: 2, to: 3 })
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('가<mark>나</mark>다')
  })
})

describe('저장되는 형태', () => {
  it('한글이 HTML 엔티티로 바뀌지 않고 그대로 저장된다', () => {
    typeHangul(editor)
    const html = editor.getHTML()
    expect(html).toContain('한글')
    expect(html).not.toContain('&#')
  })

  it('저장된 HTML을 다시 불러와도 한글이 그대로다', () => {
    typeHangul(editor)
    const saved = editor.getHTML()
    const el2 = document.createElement('div')
    document.body.appendChild(el2)
    const editor2 = createEditor({ element: el2, content: saved })
    expect(editor2.getText()).toBe('한글')
    editor2.destroy()
    el2.remove()
  })
})
