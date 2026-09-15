import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

import { t } from './i18n.js'

/**
 * 새 버전이 있으면 ⋯ 버튼에 점을 찍고 메뉴에 항목을 하나 띄운다.
 *
 * 팝업으로 물어보지 않는다. 이 앱은 알림과 물음을 없앤 앱이라, 적으려고 켠
 * 사람 앞에 창을 하나 더 띄우면 그 약속이 깨진다. 점은 보고 싶을 때 보이고
 * 무시해도 아무 일도 일어나지 않는다. 누를지는 사용자가 정한다.
 *
 * 확인에 실패해도 조용히 넘어간다. 인터넷이 없거나 깃헙이 잠깐 안 될 때
 * 메모장이 그걸 알릴 이유가 없다.
 *
 * @param {object} options
 * @param {HTMLElement} options.button  점을 찍을 ⋯ 버튼
 * @param {HTMLButtonElement} options.item  메뉴에 띄울 항목
 */
export function watchForUpdate({ button, item }) {
  check()
    .then((update) => {
      if (!update) return
      button.classList.add('has-update')
      item.textContent = t.updateTo(update.version)
      item.hidden = false
      item.addEventListener('click', async (e) => {
        // 메뉴를 닫지 않는다. 내려받는 동안 무슨 일이 일어나는지 보여야 한다.
        e.stopPropagation()
        item.disabled = true
        item.textContent = t.updating
        try {
          await update.downloadAndInstall()
          await relaunch()
        } catch (err) {
          console.error('업데이트에 실패했습니다', err)
          item.disabled = false
          item.textContent = t.updateTo(update.version)
        }
      })
    })
    .catch((err) => {
      // 인터넷이 없을 때가 대부분이다. 사용자가 할 일이 없으므로 알리지 않는다.
      console.error('업데이트를 확인하지 못했습니다', err)
    })
}
