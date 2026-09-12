/**
 * 함수 호출을 한 줄로 세운다. 앞의 호출이 끝나야 다음이 출발한다.
 *
 * 저장이 겹치면 먼저 출발한 쪽이 늦게 도착할 수 있고, 그러면 오래된 결과가
 * 최신 결과를 덮어쓴다 — 화면의 저장 표시도, 디스크의 내용도 그렇다.
 * 순서를 지키면 그 경우가 아예 생기지 않는다.
 *
 * 앞의 호출이 실패해도 줄은 끊기지 않는다. 실패 하나 때문에 이후 저장이
 * 전부 멈추는 쪽이 훨씬 나쁘다.
 */
export function serialize(fn) {
  let chain = Promise.resolve()
  return (...args) => {
    const next = chain.then(
      () => fn(...args),
      () => fn(...args),
    )
    chain = next.catch(() => {})
    return next
  }
}
