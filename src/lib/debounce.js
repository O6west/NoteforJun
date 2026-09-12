/**
 * 자동 저장용. `flush`가 있는 이유는 창을 닫거나 앱이 끝날 때
 * 대기 중인 저장을 버리지 않고 즉시 내보내야 하기 때문이다.
 */
export function debounce(fn, ms) {
  let timer = null
  let pending = null

  return {
    call(...args) {
      pending = args
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        const args2 = pending
        pending = null
        fn(...args2)
      }, ms)
    },
    flush() {
      if (!timer) return undefined
      clearTimeout(timer)
      timer = null
      const args = pending
      pending = null
      return fn(...args)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
