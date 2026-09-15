import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/bar.css'
import './styles/list.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createNote, deleteNote, listNotes, openNoteWindow } from './lib/api.js'
import { colorOf } from './lib/colors.js'
import { t } from './lib/i18n.js'
import { firstLine, previewText } from './lib/preview.js'
import { installResizeZones } from './lib/resize.js'
import { filterNotes } from './lib/search.js'

installResizeZones()

const cards = document.getElementById('cards')
const empty = document.getElementById('empty')
const search = document.getElementById('search')
const errorBox = document.getElementById('error')

// 문구는 사전 한 곳에서만 온다. HTML에 적어두면 언어가 둘이 되는 순간 어긋난다.
document.title = t.listWindowTitle
search.placeholder = t.search
document.getElementById('new-note').title = t.newNote
document.getElementById('close').title = t.close

let all = []

/** 실패는 사라지지 않는 줄로 남긴다. 조용히 넘어가면 사용자는 메모가 없어진 줄 안다. */
function showError(message, err) {
  console.error(message, err)
  errorBox.textContent = message
  errorBox.hidden = false
}

function clearError() {
  errorBox.hidden = true
}

function render() {
  const shown = filterNotes(all, search.value)
  cards.textContent = ''
  // '메모가 없다'와 '검색에 안 걸린다'는 다른 말이다. 같은 문구를 쓰면
  // 검색하다가 메모가 전부 사라진 줄 안다.
  empty.textContent = search.value.trim() ? t.noMatch : t.noNotes
  empty.hidden = shown.length > 0

  for (const n of shown) {
    const card = document.createElement('div')
    card.className = 'card'

    const stripe = document.createElement('div')
    stripe.className = 'card-stripe'
    stripe.style.background = colorOf(n.color).bar

    const body = document.createElement('div')
    body.className = 'card-body'

    const title = document.createElement('div')
    const hasTitle = (n.title ?? '').trim().length > 0
    title.className = hasTitle ? 'card-title' : 'card-title untitled'
    title.textContent = hasTitle ? n.title : firstLine(n.text) || t.emptyNote

    const preview = document.createElement('div')
    preview.className = 'card-preview'
    preview.textContent = previewText(n.text)

    const label = hasTitle ? n.title : t.untitledNote

    // 마우스를 올렸을 때만 보이는 삭제 버튼.
    // 우클릭만 두면 지울 수 있다는 사실 자체를 알 방법이 없고, 이 앱에서는
    // 여기가 메모를 지우는 유일한 곳이라 모르면 영영 못 지운다.
    // 늘 보이게 두면 메모 수만큼 ×가 늘어서 목록이 시끄러워진다.
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'card-delete'
    remove.textContent = '×'
    remove.title = t.deleteNote(label)
    remove.setAttribute('aria-label', t.deleteNote(label))

    body.append(title, preview)
    card.append(stripe, body, remove)

    async function confirmDelete() {
      if (!confirm(t.deleteConfirm(label))) return
      try {
        await deleteNote(n.id)
      } catch (err) {
        showError(t.deleteFailed, err)
        return
      }
      await refresh()
    }

    card.addEventListener('click', () =>
      openNoteWindow(n.id).catch((err) => showError(t.openFailed, err)),
    )
    remove.addEventListener('click', (e) => {
      // 카드 클릭이 같이 일어나면 지우려다 메모가 열린다
      e.stopPropagation()
      confirmDelete()
    })
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      confirmDelete()
    })

    cards.appendChild(card)
  }
}

async function refresh() {
  try {
    all = await listNotes()
    clearError()
  } catch (err) {
    showError(t.listFailed, err)
    return
  }
  render()
}

search.addEventListener('input', render)
document.getElementById('new-note').addEventListener('click', async () => {
  try {
    await createNote()
  } catch (err) {
    showError(t.createFailed, err)
    return
  }
  await refresh()
})
document.getElementById('close').addEventListener('click', () => getCurrentWindow().hide())

// 창이 다시 보일 때마다 최신 상태로 맞춘다.
getCurrentWindow().onFocusChanged(({ payload }) => {
  if (payload) refresh()
})

refresh()
