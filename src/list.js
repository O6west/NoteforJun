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

let all = []

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

    card.addEventListener('click', () => openNoteWindow(n.id))
    card.addEventListener('contextmenu', async (e) => {
      e.preventDefault()
      const label = hasTitle ? n.title : '제목 없는 메모'
      if (confirm(`"${label}" 메모를 삭제할까요?\n되돌릴 수 없습니다.`)) {
        await deleteNote(n.id)
        await refresh()
      }
    })

    cards.appendChild(card)
  }
}

async function refresh() {
  all = await listNotes()
  render()
}

search.addEventListener('input', render)
document.getElementById('new-note').addEventListener('click', async () => {
  await createNote()
  await refresh()
})
document.getElementById('close').addEventListener('click', () => getCurrentWindow().hide())

// 창이 다시 보일 때마다 최신 상태로 맞춘다.
getCurrentWindow().onFocusChanged(({ payload }) => {
  if (payload) refresh()
})

refresh()
