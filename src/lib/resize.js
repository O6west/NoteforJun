import { getCurrentWindow } from '@tauri-apps/api/window'

const ZONES = [
  { dir: 'NorthWest', cls: 'nw' },
  { dir: 'North', cls: 'n' },
  { dir: 'NorthEast', cls: 'ne' },
  { dir: 'West', cls: 'w' },
  { dir: 'East', cls: 'e' },
  { dir: 'SouthWest', cls: 'sw' },
  { dir: 'South', cls: 's' },
  { dir: 'SouthEast', cls: 'se' },
]

/**
 * 창 둘레에 보이지 않는 크기 조절 영역을 두른다.
 *
 * 창 테두리를 껐기 때문에(상단바를 직접 그리려고) OS가 주던 리사이즈 테두리도
 * 함께 사라졌다. 남은 판정 영역이 몇 px뿐이라 조준이 조금만 어긋나도 실패한다.
 *
 * 가장자리는 8px로 좁게, 모서리는 20px로 넓게 잡는다. 사람은 창 크기를 바꿀 때
 * 주로 모서리를 노리고, 가장자리를 더 넓히면 본문 첫 글자를 클릭하려다
 * 창 크기가 바뀌는 더 성가신 문제가 생긴다.
 */
export function installResizeZones(container = document.body) {
  const win = getCurrentWindow()
  for (const { dir, cls } of ZONES) {
    const el = document.createElement('div')
    el.className = `resize-zone resize-${cls}`
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      win.startResizeDragging(dir)
    })
    container.appendChild(el)
  }
}
