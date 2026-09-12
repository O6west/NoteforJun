/**
 * 입력 규칙(`# `, `- `)은 handleTextInput을 거치는 실제 타이핑에만 반응한다.
 * insertContent로는 발동하지 않으므로 ProseMirror에 한 글자씩 직접 흘려보낸다.
 */
export function typeText(editor, text) {
  const { view } = editor
  for (const ch of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch))
    if (!handled) {
      view.dispatch(view.state.tr.insertText(ch, from, to))
    }
  }
}
