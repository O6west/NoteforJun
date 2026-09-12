import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/bar.css'
import './styles/list.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createNote, deleteNote, listNotes, openNoteWindow } from './lib/api.js'
import { colorOf } from './lib/colors.js'
import { firstLine, previewText } from './lib/preview.js'
import { installResizeZones } from './lib/resize.js'
import { filterNotes } from './lib/search.js'

installResizeZones()

const cards = document.getElementById('cards')
const empty = document.getElementById('empty')
const search = document.getElementById('search')
const errorBox = document.getElementById('error')

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
    title.textContent = hasTitle ? n.title : firstLine(n.text) || '(빈 메모)'

    const preview = document.createElement('div')
    preview.className = 'card-preview'
    preview.textContent = previewText(n.text)

    body.append(title, preview)
    card.append(stripe, body)

    card.addEventListener('click', () =>
      openNoteWindow(n.id).catch((err) => showError('메모를 열지 못했습니다.', err)),
    )
    card.addEventListener('contextmenu', async (e) => {
      e.preventDefault()
      const label = hasTitle ? n.title : '제목 없는 메모'
      if (confirm(`"${label}" 메모를 삭제할까요?\n되돌릴 수 없습니다.`)) {
        try {
          await deleteNote(n.id)
        } catch (err) {
          showError('메모를 지우지 못했습니다.', err)
          return
        }
        await refresh()
      }
    })

    cards.appendChild(card)
  }
}

async function refresh() {
  try {
    all = await listNotes()
    clearError()
  } catch (err) {
    showError('메모 목록을 불러오지 못했습니다.', err)
    return
  }
  render()
}

search.addEventListener('input', render)
document.getElementById('new-note').addEventListener('click', async () => {
  try {
    await createNote()
  } catch (err) {
    showError('새 메모를 만들지 못했습니다.', err)
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
