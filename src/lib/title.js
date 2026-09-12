export const TITLE_MAX = 20

/**
 * HTML의 maxlength는 붙여넣기와 IME 조합을 완전히 막지 못한다.
 * 저장 직전에 한 번 더 거른다.
 */
export function clampTitle(value) {
  if (!value) return ''
  return String(value).replace(/[\r\n]+/g, ' ').trim().slice(0, TITLE_MAX)
}
