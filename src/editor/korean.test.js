import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createEditor } from './editor.js'

let editor
let element

/**
 * 한글 입력을 흉내낸다.
 *
 * 정직하게 적어둔다. 아래 compositionstart/update/end 이벤트는 **실제로는
 * 아무것도 바꾸지 않는다.** jsdom에는 IME가 없고, 우리가 쓰는 확장 중에 조합
 * 이벤트를 듣는 것도 없다. 글자를 넣는 것은 마지막 줄의 insertText 하나뿐이며,
 * 이벤트 세 줄을 지워도 이 파일의 모든 테스트는 똑같이 통과한다.
 *
 * 그러므로 이 파일이 지키는 것은 조합 "도중"의 안전성이 아니라 이것들이다.
 *   - 한글이 들어간 뒤 글자와 문서 구조가 온전한가
 *   - 한글·영문·숫자를 섞었을 때 순서가 보존되는가
 *   - 큰 글씨와 체크박스 안에서, 그리고 일부 글자에만 서식이 제대로 걸리는가
 *   - 저장용 HTML로 나갔다 들어와도 한글이 엔티티로 바뀌지 않는가
 *
 * 조합 도중 글자가 깜빡이는지, 커서가 튀는지, 조합 중 자동 저장에 글자가
 * 날아가는지는 사람이 직접 쳐봐야만 알 수 있다. Task 10 수동 체크리스트에 있다.
 *
 * 이벤트를 남겨두는 이유는 하나뿐이다. 나중에 조합 이벤트를 듣는 확장이나
 * 직접 만든 처리가 들어오면, 그때부터는 이 테스트들이 진짜로 그 경로를 지나간다.
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
    typeText(editor, '[] ')
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
