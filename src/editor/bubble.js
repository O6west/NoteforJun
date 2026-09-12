/**
 * 드래그하면 뜨는 서식 팝업.
 * 형광펜에 단축키가 없으므로 이 팝업이 형광펜의 유일한 입구다.
 * 익숙한 B I U 옆에 두어 따로 알려주지 않아도 눈에 띄게 한다.
 */
const BUTTONS = [
  { mark: 'bold', label: 'B', command: 'toggleBold', title: '굵게 (Ctrl+B)' },
  { mark: 'italic', label: 'I', command: 'toggleItalic', title: '기울임 (Ctrl+I)' },
  { mark: 'underline', label: 'U', command: 'toggleUnderline', title: '밑줄 (Ctrl+U)' },
  { mark: 'highlight', label: '✏', command: 'toggleHighlight', title: '형광펜' },
]

export function createBubble({ editor, container }) {
  const element = document.createElement('div')
  element.id = 'bubble'
  element.hidden = true

  for (const b of BUTTONS) {
    const btn = document.createElement('button')
    btn.dataset.mark = b.mark
    btn.textContent = b.label
    btn.title = b.title
    btn.setAttribute('aria-pressed', 'false')
    // mousedown을 막지 않으면 버튼을 누르는 순간 선택이 풀린다.
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      editor.chain().focus()[b.command]().run()
      update()
    })
    element.appendChild(btn)
  }
  container.appendChild(element)

  function update() {
    const { from, to, empty } = editor.state.selection
    if (empty || from === to) {
      element.hidden = true
      return
    }
    element.hidden = false
    for (const b of BUTTONS) {
      element
        .querySelector(`[data-mark="${b.mark}"]`)
        .setAttribute('aria-pressed', String(editor.isActive(b.mark)))
    }
    position()
  }

  function position() {
    // jsdom에는 좌표가 없다. 실제 앱에서만 의미가 있다.
    if (typeof editor.view.coordsAtPos !== 'function') return
    try {
      const { from, to } = editor.state.selection
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      const box = container.getBoundingClientRect()
      const centerX = (start.left + end.left) / 2 - box.left
      element.style.left = `${Math.max(8, centerX - element.offsetWidth / 2)}px`
      element.style.top = `${start.top - box.top - element.offsetHeight - 8}px`
    } catch {
      // 좌표를 못 구하면 위치만 포기하고 팝업은 그대로 둔다.
    }
  }

  editor.on('selectionUpdate', update)
  editor.on('blur', () => {
    element.hidden = true
  })

  return {
    element,
    update,
    destroy() {
      editor.off('selectionUpdate', update)
      element.remove()
    },
  }
}
