import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('debounce', () => {
  it('지연 시간이 지나야 호출된다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('연달아 부르면 마지막 인자로 한 번만 호출된다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    vi.advanceTimersByTime(200)
    d.call('b')
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('flush는 기다리지 않고 즉시 호출한다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    d.flush()
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('대기 중인 호출이 없으면 flush는 아무 일도 하지 않는다', () => {
    const fn = vi.fn()
    debounce(fn, 500).flush()
    expect(fn).not.toHaveBeenCalled()
  })

  it('cancel하면 호출되지 않는다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush는 대기 중이던 함수의 반환값을 그대로 돌려준다', () => {
    const fn = vi.fn(() => 'saved')
    const d = debounce(fn, 500)
    d.call('a')
    expect(d.flush()).toBe('saved')
  })

  it('대기 중인 호출이 없으면 flush는 undefined를 돌려준다', () => {
    expect(debounce(vi.fn(), 500).flush()).toBeUndefined()
  })

  it('flush가 돌려준 약속을 기다릴 수 있다', async () => {
    const fn = vi.fn(() => Promise.resolve('저장됨'))
    const d = debounce(fn, 500)
    d.call()
    await expect(d.flush()).resolves.toBe('저장됨')
  })
})
