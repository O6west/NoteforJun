import { t } from './i18n.js'

/**
 * 상단바 ? 도움말.
 *
 * 커서를 올리거나 초점이 닿으면 안내가 뜬다. 초점으로도 열리게 하는 이유는
 * 키보드만 쓰는 사람에게도 닿아야 하기 때문이다.
 *
 * 다만 정방향 Tab으로는 닿지 않는다 — note.js의 제목 입력칸 처리가 Tab을
 * 가로채 본문으로 보내므로, 정방향 Tab은 + → 제목 → 본문 세 칸을 돈다.
 * ?에 닿는 길은 본문에서 Shift+Tab(→ × → ⋯ → ?)이다. ⋯ 와 × 도 같은 처지다.
 *
 * 브라우저 기본 툴팁(title 속성)을 쓰지 않는 이유는 줄바꿈이 안 되고,
 * 뜨기까지 1초 넘게 걸리며, 키보드 초점으로는 열리지 않아서다.
 */
/**
 * 왼쪽에 치는 것, 오른쪽에 그 결과.
 *
 * 결과를 설명하지 않고 그 모양 그대로 보여준다 — "제목"을 크게 써두면
 * 무엇이 되는지 읽지 않아도 보인다. 설명을 읽게 만들면 외워야 할 목록이 되고,
 * 보여주면 한번 쳐보게 된다.
 *
 * Ctrl+B·I·U는 적지 않는다. 수십 년간 모든 프로그램에서 똑같이 동작해온
 * 공용 지식이라 이미 알고 온다. 아는 것을 적어두면 안내가 길어지기만 하고,
 * 이 목록이 "외워야 할 것"처럼 보이기 시작한다.
 */
const LINES = [
  ['[ ]', t.helpTask, ''],
  ['#', t.helpHeading, 'as-h1'],
  ['->', t.helpArrow, ''],
  ['Ctrl+Alt+N', t.helpNewNote, ''],
]

export function createHelp({ button, container, menu = null }) {
  const element = document.createElement('div')
  element.id = 'help'
  element.hidden = true
  element.setAttribute('role', 'tooltip')

  // 치는 것 / 화살표 / 결과 세 칸으로 쌓는다. 세 칸 다 내용만큼만 차지하므로
  // 창을 키워도 팝업이 같이 늘어나지 않는다.
  for (const [key, what, style] of LINES) {
    const k = document.createElement('kbd')
    k.textContent = key

    // 화살표는 낭독기에서 "오른쪽 화살표"로 읽혀 봐야 방해만 된다.
    const arrow = document.createElement('span')
    arrow.className = 'arrow'
    arrow.textContent = '→'
    arrow.setAttribute('aria-hidden', 'true')

    const result = document.createElement('span')
    result.textContent = what
    if (style) result.className = style

    element.append(k, arrow, result)
  }
  container.appendChild(element)

  button.setAttribute('aria-describedby', 'help')

  const show = () => {
    // ⋯ 메뉴가 열려 있으면 뜨지 않는다. 둘 다 상단바 바로 아래 같은 자리를
    // 쓰는데 도움말이 위층(103)이라, 그냥 두면 방금 눌러서 연 메뉴를 통째로 덮는다.
    // 클릭해서 연 쪽이 이긴다 — 커서가 스쳤을 뿐인 쪽이 아니라.
    if (menu && !menu.hidden) return
    element.hidden = false
  }
  const hide = () => {
    element.hidden = true
  }

  button.addEventListener('mouseenter', show)
  button.addEventListener('mouseleave', hide)
  button.addEventListener('focus', show)
  button.addEventListener('blur', hide)

  return {
    element,
    destroy() {
      button.removeEventListener('mouseenter', show)
      button.removeEventListener('mouseleave', hide)
      button.removeEventListener('focus', show)
      button.removeEventListener('blur', hide)
      element.remove()
    },
  }
}
