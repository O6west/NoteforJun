// jsdom에는 아래 API가 없거나 비어 있어서 ProseMirror가 초기화에 실패한다.
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
  })
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  })
}
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}
