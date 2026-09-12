import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/note.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createEditor } from './editor/editor.js'
import {
  createNote,
  hideNoteWindow,
  loadNote,
  openListWindow,
  saveNote,
} from './lib/api.js'
import { COLORS, DEFAULT_COLOR } from './lib/colors.js'
import { debounce } from './lib/debounce.js'
import { installResizeZones } from './lib/resize.js'
import { clampTitle } from './lib/title.js'

const SAVE_DELAY = 500

installResizeZones()

const id = new URLSearchParams(location.search).get('id')
const shell = document.getElementById('shell')
const titleInput = document.getElementById('title')
const menu = document.getElementById('menu')
const swatches = document.getElementById('swatches')

let note = null
let editor = null

const savedMark = document.getElementById('saved')
let savedTimer = null

/**
 * 저장이 끝났다는 표시를 잠깐 띄운다.
 * 아무 신호도 없이 조용히 저장하면 사용자는 저장됐는지 알 수 없고,
 * 그렇다고 늘 띄워두면 잔소리가 된다. 그래서 떴다가 스스로 사라진다.
 */
function flashSaved() {
  savedMark.classList.add('show')
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => savedMark.classList.remove('show'), 900)
}

const saver = debounce(() => {
  if (note) saveNote(note).then(flashSaved)
}, SAVE_DELAY)

function applyColor(key) {
  shell.dataset.color = key
  for (const btn of swatches.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.key === key))
  }
}

function buildSwatches() {
  for (const c of COLORS) {
    const btn = document.createElement('button')
    btn.className = 'swatch'
    btn.dataset.key = c.key
    btn.style.background = c.bar
    btn.title = c.key
    btn.addEventListener('click', () => {
      note.color = c.key
      applyColor(c.key)
      saver.call()
      menu.hidden = true
    })
    swatches.appendChild(btn)
  }
}

async function boot() {
  note = await loadNote(id)
  buildSwatches()
  applyColor(note.color || DEFAULT_COLOR)

  titleInput.value = note.title
  titleInput.addEventListener('input', () => {
    note.title = clampTitle(titleInput.value)
    saver.call()
  })

  editor = createEditor({
    element: document.getElementById('editor'),
    content: note.content,
    onUpdate: (html) => {
      note.content = html
      saver.call()
    },
  })

  document.getElementById('new-note').addEventListener('click', () => createNote())
  document.getElementById('open-list').addEventListener('click', () => {
    menu.hidden = true
    openListWindow()
  })
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    menu.hidden = !menu.hidden
  })
  document.addEventListener('click', () => {
    menu.hidden = true
  })
  document.getElementById('close').addEventListener('click', async () => {
    saver.flush()
    await hideNoteWindow(id)
  })

  // 창 위치·크기는 이동이 끝난 시점에만 저장한다.
  const win = getCurrentWindow()
  const remember = debounce(async () => {
    const pos = await win.outerPosition()
    const size = await win.innerSize()
    note.window = { x: pos.x, y: pos.y, width: size.width, height: size.height, visible: true }
    saveNote(note).then(flashSaved)
  }, SAVE_DELAY)
  await win.onMoved(() => remember.call())
  await win.onResized(() => remember.call())

  titleInput.focus()
}

boot()
