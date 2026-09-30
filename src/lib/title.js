import { firstLine } from './preview.js'

export const TITLE_MAX = 20

/**
 * HTML의 maxlength는 붙여넣기와 IME 조합을 완전히 막지 못한다.
 * 저장 직전에 한 번 더 거른다.
 */
export function clampTitle(value) {
  if (!value) return ''
  return String(value).replace(/[\r\n]+/g, ' ').trim().slice(0, TITLE_MAX)
}

export const APP_NAME = 'NoteforJun'

/**
 * 작업표시줄과 창 목록에 뜰 창 이름.
 *
 * 앱 이름을 그대로 두면 메모를 여럿 띄웠을 때 작업표시줄에 'NoteforJun'만
 * 줄줄이 뜬다 — 어느 것이 어느 것인지 가릴 방법이 없다.
 *
 * 규칙은 목록 창 카드가 쓰는 것을 그대로 가져온다. 같은 메모가 목록에서는
 * 본문 첫 줄로, 작업표시줄에서는 앱 이름으로 보이면 같은 것으로 안 보인다.
 */
export function windowTitle(title, text) {
  return clampTitle(title) || clampTitle(firstLine(text)) || APP_NAME
}
