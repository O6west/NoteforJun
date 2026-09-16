import { t } from './i18n.js'

/**
 * 삭제를 한 번 더 묻는 창.
 *
 * 브라우저 confirm()을 쓰지 않는 이유가 있다. WebView2가 그리는 그 창에는
 * "tauri.localhost의 메시지"라는 제목이 먼저 붙는다 — 사용자가 본 적 없는
 * 주소가 갑자기 튀어나오니 앱이 뭔가 잘못된 것처럼 보인다. 색도 앱과 따로
 * 놀고, 무엇보다 목록 창이 좁으면 버튼이 창 밖으로 잘려 나간다.
 * 지우겠냐고 물어놓고 취소 버튼이 안 보이는 것은 묻지 않은 것만 못하다.
 *
 * 물음 자체는 없앨 수 없다. 이 앱에서 되돌릴 수 없는 동작은 이것 하나뿐이다.
 */
export function askToDelete(label, root = document.body) {
  return new Promise((resolve) => {
    const before = document.activeElement

    const backdrop = document.createElement('div')
    backdrop.className = 'ask-backdrop'

    const box = document.createElement('div')
    box.className = 'ask'
    box.setAttribute('role', 'alertdialog')
    box.setAttribute('aria-modal', 'true')

    const message = document.createElement('p')
    message.className = 'ask-message'
    message.textContent = t.deleteConfirm(label)
    box.setAttribute('aria-label', message.textContent)

    const buttons = document.createElement('div')
    buttons.className = 'ask-buttons'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'ask-btn'
    cancel.textContent = t.cancel

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'ask-btn danger'
    remove.textContent = t.deleteAction

    buttons.append(cancel, remove)
    box.append(message, buttons)
    backdrop.appendChild(box)
    root.appendChild(backdrop)

    // 되돌릴 수 없는 쪽에 초점을 두지 않는다. ×를 누른 뒤 Enter를 치는 손이
    // 그대로 메모를 지워버리면, 물어본 의미가 없다.
    cancel.focus()

    const close = (answer) => {
      document.removeEventListener('keydown', onKey, true)
      backdrop.remove()
      // 묻기 전에 보던 자리로 초점을 돌려놓는다. 안 그러면 취소한 뒤
      // 키보드만 쓰는 사람의 초점이 목록 맨 처음으로 튕겨 나간다.
      if (before instanceof HTMLElement && before.isConnected) before.focus()
      resolve(answer)
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
      } else if (e.key === 'Tab') {
        // Tab이 뒤에 깔린 목록으로 새면 안 보이는 곳에 초점이 가 있게 된다.
        e.preventDefault()
        ;(document.activeElement === cancel ? remove : cancel).focus()
      }
    }

    cancel.addEventListener('click', () => close(false))
    remove.addEventListener('click', () => close(true))
    // 바깥을 누르는 것은 취소다. 지우는 쪽은 눌러야만 일어난다.
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false)
    })
    document.addEventListener('keydown', onKey, true)
  })
}
