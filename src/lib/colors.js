/**
 * 메모 상단바 색. 6가지가 전부이며 사용자가 색을 만들 수 없다.
 * 색을 늘리려면 colors.test.js도 같이 고쳐야 한다 — 의도적인 마찰이다.
 */
export const COLORS = [
  { key: 'yellow', bar: '#E0B84D', fg: '#3D2F10' },
  { key: 'green', bar: '#7FA86B', fg: '#FFFFFF' },
  { key: 'purple', bar: '#A98BC4', fg: '#FFFFFF' },
  { key: 'blue', bar: '#6FA3BF', fg: '#FFFFFF' },
  { key: 'orange', bar: '#D98C6A', fg: '#FFFFFF' },
  { key: 'gray', bar: '#9A9A94', fg: '#FFFFFF' },
]

export const DEFAULT_COLOR = 'yellow'

export function colorOf(key) {
  return COLORS.find((c) => c.key === key) ?? COLORS[0]
}
