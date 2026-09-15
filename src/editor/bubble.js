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
  element.setAttribute('role', 'toolbar')
  element.setAttribute('aria-label', '서식')

  for (const b of BUTTONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.mark = b.mark
    btn.textContent = b.label
    btn.title = b.title
    // 글자만으로는 뜻이 안 통한다. 특히 ✏는 낭독기가 "연필"이라고만 읽는다.
    btn.setAttribute('aria-label', b.title)
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
      const w = element.offsetWidth
      const h = element.offsetHeight

      // 좌우로 가둔다. 그냥 두면 줄 끝을 드래그했을 때 오른쪽 끝의 형광펜 버튼이
      // 창 밖으로 밀려나 눌리지 않는다.
      // 창 최소 폭이 260px이고 팝업은 132px이면 충분하므로 이 식은 항상 성립한다.
      const centerX = (start.left + end.left) / 2 - box.left
      const maxLeft = Math.max(8, box.width - w - 8)
      element.style.left = `${Math.min(maxLeft, Math.max(8, centerX - w / 2))}px`

      // 위로 올릴 자리가 없으면 아래로 내린다.
      //
      // "자리가 없다"의 기준은 상단바를 실제로 재서 잡는다. 상수를 박아두면
      // 상단바 높이나 팝업 크기가 바뀔 때 조용히 어긋난다 — 실제로 4px로
      // 잡아뒀다가 34px짜리 상단바를 못 피한 적이 있다. 팝업이 상단바를 덮으면
      // 창 손잡이와 +/⋯/× 버튼이 가려져 눌리지 않는다.
      const bar = container.querySelector('#titlebar')
      const minTop = (bar ? bar.getBoundingClientRect().bottom - box.top : 0) + 4
      const maxTop = Math.max(minTop, box.height - h - 8)
      const above = start.top - box.top - h - 8
      const below = end.bottom - box.top + 8
      const top = above >= minTop ? above : below
      element.style.top = `${Math.min(maxTop, Math.max(minTop, top))}px`
    } catch {
      // 좌표를 못 구하면 위치만 포기하고 팝업은 그대로 둔다.
    }
  }

  /**
   * 본문에서 초점이 떠나면 팝업을 감춘다.
   *
   * 단, 초점이 팝업 버튼으로 옮겨가는 중이면 감추지 않는다. 본문에서 Tab을 누르면
   * 바로 이 팝업으로 오는데, 그때 감춰버리면 키보드로는 형광펜에 영영 닿을 수 없다.
   * blur는 새 요소가 초점을 받기 전에 먼저 오므로 한 박자 뒤에 확인한다.
   */
  const hide = () => {
    setTimeout(() => {
      if (element.contains(document.activeElement)) return
      element.hidden = true
    }, 0)
  }

  /**
   * 본문에서 Tab을 누르면 팝업 첫 버튼으로 보낸다.
   *
   * 팝업 안에서 버튼 사이를 도는 것(onKeyDown)은 원래 있었는데, 그 앞 단계인
   * 본문 → 팝업 인계가 브라우저 기본 탭 순서에 맡겨져 있었다. 팝업이 #shell
   * 맨 끝에 붙어 있어서 "우연히" 본문 다음 차례가 되는 구조다. 명시적으로 잇는다.
   *
   * Shift+Tab은 가로채지 않는다. 뒤로 가는 길은 상단바로 올라가는 것이 맞다.
   */
  const onEditorKeyDown = (e) => {
    if (e.key !== 'Tab' || e.shiftKey || element.hidden) return
    const first = element.querySelector('button')
    if (!first) return
    e.preventDefault()
    first.focus()
  }

  const onKeyDown = (e) => {
    // Esc로 빠져나간다. 팝업 안에서 Tab이 맴돌기 때문에 나가는 길은 이것뿐이고,
    // 그래서 하나로 분명해야 한다.
    if (e.key === 'Escape') {
      e.preventDefault()
      element.hidden = true
      editor.commands.focus()
      return
    }

    // Tab은 팝업 안에서 돈다. 마지막 형광펜에서 Tab을 누르면 처음 굵게로 돌아온다.
    // 그냥 두면 네 번째에서 팝업 밖으로 나가버려, 버튼을 훑어보려면 매번
    // 본문으로 돌아갔다 다시 들어와야 한다.
    if (e.key !== 'Tab') return
    const buttons = [...element.querySelectorAll('button')]
    if (buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  }

  element.addEventListener('keydown', onKeyDown)
  editor.view.dom.addEventListener('keydown', onEditorKeyDown)
  editor.on('selectionUpdate', update)
  editor.on('blur', hide)

  return {
    element,
    update,
    destroy() {
      element.removeEventListener('keydown', onKeyDown)
      editor.view.dom.removeEventListener('keydown', onEditorKeyDown)
      editor.off('selectionUpdate', update)
      editor.off('blur', hide)
      element.remove()
    },
  }
}
