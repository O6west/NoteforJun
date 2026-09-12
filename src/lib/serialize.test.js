import { describe, expect, it, vi } from 'vitest'
import { serialize } from './serialize.js'

/** 지정한 시간 뒤에 값을 내놓는 약속 */
function after(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

describe('serialize', () => {
  it('앞의 호출이 끝난 뒤에 다음이 출발한다', async () => {
    const order = []
    const run = serialize(async (name, ms) => {
      order.push(`${name} 시작`)
      await after(ms)
      order.push(`${name} 끝`)
    })

    const a = run('A', 30)
    const b = run('B', 1)
    await Promise.all([a, b])

    expect(order).toEqual(['A 시작', 'A 끝', 'B 시작', 'B 끝'])
  })

  it('먼저 출발한 느린 호출이 나중 호출보다 늦게 끝나는 일이 없다', async () => {
    const finished = []
    const run = serialize(async (name, ms) => {
      await after(ms)
      finished.push(name)
    })

    await Promise.all([run('느림', 30), run('빠름', 1)])

    expect(finished).toEqual(['느림', '빠름'])
  })

  it('앞의 호출이 실패해도 다음 호출은 실행된다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('실패'))
      .mockResolvedValueOnce('성공')
    const run = serialize(fn)

    await expect(run()).rejects.toThrow('실패')
    await expect(run()).resolves.toBe('성공')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('호출한 쪽은 자기 호출의 결과를 돌려받는다', async () => {
    const run = serialize((v) => Promise.resolve(v * 2))
    await expect(Promise.all([run(1), run(2), run(3)])).resolves.toEqual([2, 4, 6])
  })
})
