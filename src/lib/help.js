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
const LINES = [
  ['[]', '→   ☐ 할 일'],
  ['#', '→   제목'],
  ['Ctrl+B  I  U', ''],
  ['Ctrl+Alt+N', '새 메모'],
]

export function createHelp({ button, container, menu = null }) {
  const element = document.createElement('div')
  element.id = 'help'
  element.hidden = true
  element.setAttribute('role', 'tooltip')

  // 두 칸짜리 격자로 쌓는다. 칸을 나눠두면 창이 최소 폭(260px)까지 좁아져도
  // 설명만 줄바꿈되고 왼쪽 열은 그대로 줄이 맞는다.
  for (const [key, what] of LINES) {
    const k = document.createElement('kbd')
    k.textContent = key
    const w = document.createElement('span')
    w.textContent = what
    element.append(k, w)
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
