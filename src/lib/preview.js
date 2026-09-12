/** 제목이 비어 있을 때 목록 카드에 대신 보여줄 본문 첫 줄. */
export function firstLine(text) {
  if (!text) return ''
  return text.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
}

/** 목록 카드의 2줄 미리보기. 줄바꿈을 가운뎃점으로 이어 한 덩어리로 만든다. */
export function previewText(text, maxChars = 60) {
  if (!text) return ''
  const flat = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' · ')
  return flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat
}
