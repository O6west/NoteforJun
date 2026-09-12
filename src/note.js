import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/bar.css'
import './styles/note.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createBubble } from './editor/bubble.js'
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
import { serialize } from './lib/serialize.js'
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
let remember = null

const savedMark = document.getElementById('saved')
let savedTimer = null
let lastSaveFailed = false
let closeHeld = false

/**
 * 저장이 끝났다는 표시를 잠깐 띄운다.
 * 아무 신호도 없이 조용히 저장하면 사용자는 저장됐는지 알 수 없고,
 * 그렇다고 늘 띄워두면 잔소리가 된다. 그래서 떴다가 스스로 사라진다.
 */
function flashSaved() {
  lastSaveFailed = false
  closeHeld = false
  savedMark.textContent = '✓'
  savedMark.title = ''
  savedMark.classList.remove('warn')
  savedMark.classList.add('show')
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => savedMark.classList.remove('show'), 900)
}

/** 저장 실패는 사라지지 않는 경고로 남긴다. 글이 날아가는 것이 이 앱 최악의 사고다. */
function showSaveError(err) {
  console.error('메모를 저장하지 못했습니다', err)
  lastSaveFailed = true
  clearTimeout(savedTimer)
  savedMark.textContent = '⚠'
  savedMark.title = '저장하지 못했습니다. 창을 닫지 말고 글을 복사해 두세요.'
  savedMark.classList.add('show', 'warn')
}

/**
 * 메모를 못 읽어도 창은 닫을 수 있어야 한다.
 *
 * 저장 실패와 달리 lastSaveFailed를 세우지 않는 것은 의도한 비대칭이다.
 * 불러오기가 실패하면 boot()이 멈춰 제목·본문 듣기가 붙지 않으므로
 * 사용자가 고친 것이 없고, 잃을 글도 없다. 붙잡을 이유가 없다.
 */
function showLoadError(err) {
  console.error('메모를 불러오지 못했습니다', err)
  const editorEl = document.getElementById('editor')
  editorEl.textContent = '이 메모를 불러오지 못했습니다. 파일이 손상되었을 수 있습니다.'
  editorEl.style.opacity = '0.55'
  savedMark.textContent = '⚠'
  savedMark.title = '메모를 불러오지 못했습니다.'
  savedMark.classList.add('show', 'warn')
}

/** 저장은 한 번에 하나씩만 나간다. 겹치면 오래된 결과가 최신 결과를 덮는다. */
const saveInOrder = serialize((n) => saveNote(n))

/** 저장하는 유일한 통로. 성공하면 표시를 띄우고, 실패하면 경고를 남긴다. */
function persist() {
  if (!note) return Promise.resolve()
  return saveInOrder(note).then(flashSaved, showSaveError)
}

const saver = debounce(() => persist(), SAVE_DELAY)

// 무슨 일이 있어도 창은 닫을 수 있어야 한다. 불러오기가 실패해도 마찬가지다.
document.getElementById('close').addEventListener('click', async () => {
  await saver.flush()
  if (remember) await remember.flush()

  // 저장이 실패했는데 창을 숨기면 경고를 볼 수 없고 글도 잃는다.
  // 한 번은 붙잡아 두고, 그래도 닫겠다면 그때는 닫아준다 —
  // 창 테두리가 없어 × 말고는 닫을 방법이 없으므로 영영 가둘 수는 없다.
  if (lastSaveFailed && !closeHeld) {
    closeHeld = true
    savedMark.title =
      '저장하지 못했습니다. 글을 복사해 두세요. ×를 한 번 더 누르면 저장하지 않고 닫습니다.'
    return
  }

  await hideNoteWindow(id)
})

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
  try {
    note = await loadNote(id)
  } catch (err) {
    showLoadError(err)
    return
  }
  buildSwatches()
  applyColor(note.color || DEFAULT_COLOR)

  titleInput.value = note.title
  titleInput.addEventListener('input', () => {
    note.title = clampTitle(titleInput.value)
    saver.call()
  })

  // 제목을 다 쓰면 본문으로 내려간다. 제목은 한 줄이라 Enter가 할 일이 따로 없고,
  // Tab은 그냥 두면 ⋯ 버튼으로 가버려서 정작 쓰려던 본문을 건너뛴다.
  titleInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && !(e.key === 'Tab' && !e.shiftKey)) return
    if (e.isComposing) return // 한글 조합을 끝내는 Enter는 넘기지 않는다
    e.preventDefault()
    editor?.commands.focus('end')
  })

  editor = createEditor({
    element: document.getElementById('editor'),
    content: note.content,
    onUpdate: (html) => {
      note.content = html
      saver.call()
    },
  })
  createBubble({ editor, container: shell })

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

  // 창 위치·크기는 이동이 끝난 시점에만 저장한다.
  const win = getCurrentWindow()
  remember = debounce(async () => {
    const pos = await win.outerPosition()
    const size = await win.innerSize()
    note.window = { x: pos.x, y: pos.y, width: size.width, height: size.height, visible: true }
    return persist()
  }, SAVE_DELAY)
  await win.onMoved(() => remember.call())
  await win.onResized(() => remember.call())

  titleInput.focus()
}

boot()
