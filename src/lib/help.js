/**
 * 상단바 ? 도움말.
 *
 * 커서를 올리거나 Tab으로 초점이 닿으면 안내가 뜬다. 키보드로도 열리게 하는
 * 이유는 이 앱이 이미 제목 → 본문 → 서식 팝업을 Tab으로 잇고 있어서,
 * ?만 마우스 전용이면 그 흐름이 거기서 끊기기 때문이다.
 *
 * 브라우저 기본 툴팁(title 속성)을 쓰지 않는 이유는 줄바꿈이 안 되고,
 * 뜨기까지 1초 넘게 걸리며, 키보드 초점으로는 열리지 않아서다.
 */
const LINES = [
  ['[] 또는 - 다음 스페이스', '할 일 박스'],
  ['# 다음 스페이스', '제목'],
  ['Ctrl+B / I / U', '굵게 / 기울임 / 밑줄'],
  ['글자를 끌면', '형광펜 포함 서식 팝업'],
  ['Ctrl+Alt+N', '새 메모'],
]

export function createHelp({ button, container }) {
  const element = document.createElement('div')
  element.id = 'help'
  element.hidden = true
  element.setAttribute('role', 'tooltip')

  // 두 칸짜리 격자로 쌓는다. 칸을 나눠두면 창이 최소 폭(220px)까지 좁아져도
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
