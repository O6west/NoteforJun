/**
 * 대소문자를 구분하지 않는 단순 부분 일치.
 * 초성 검색과 정규식은 의도적으로 지원하지 않는다.
 */
export function filterNotes(summaries, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return summaries
  return summaries.filter(
    (n) =>
      (n.title ?? '').toLowerCase().includes(q) ||
      (n.text ?? '').toLowerCase().includes(q),
  )
}
