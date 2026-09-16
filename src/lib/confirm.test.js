import { afterEach, describe, expect, it } from 'vitest'
import { askToDelete } from './confirm.js'
import { t } from './i18n.js'

const backdrop = () => document.querySelector('.ask-backdrop')
const buttons = () => [...document.querySelectorAll('.ask-btn')]
const cancelButton = () => buttons()[0]
const deleteButton = () => buttons()[1]

const press = (key) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

afterEach(() => {
  document.body.textContent = ''
})

describe('삭제 확인', () => {
  it('지울 메모가 무엇인지 보여준다', async () => {
    const answer = askToDelete('장보기')
    expect(document.querySelector('.ask-message').textContent).toContain('장보기')
    cancelButton().click()
    await answer
  })

  it('삭제를 누르면 지운다고 답한다', async () => {
    const answer = askToDelete('장보기')
    deleteButton().click()
    expect(await answer).toBe(true)
  })

  it('취소를 누르면 지우지 않는다고 답한다', async () => {
    const answer = askToDelete('장보기')
    cancelButton().click()
    expect(await answer).toBe(false)
  })

  it('Escape는 취소다', async () => {
    const answer = askToDelete('장보기')
    press('Escape')
    expect(await answer).toBe(false)
  })

  it('바깥을 누르면 취소다', async () => {
    const answer = askToDelete('장보기')
    backdrop().click()
    expect(await answer).toBe(false)
  })

  it('답하고 나면 창이 사라진다', async () => {
    const answer = askToDelete('장보기')
    expect(backdrop()).not.toBe(null)
    cancelButton().click()
    await answer
    expect(backdrop()).toBe(null)
  })

  // Enter를 누르던 손이 그대로 메모를 지우는 일이 없어야 한다.
  // 되돌릴 수 없는 쪽에 초점을 두지 않는 것이 이 창의 유일한 안전장치다.
  it('처음 초점은 삭제가 아니라 취소에 있다', async () => {
    const answer = askToDelete('장보기')
    expect(document.activeElement.textContent).toBe(t.cancel)
    press('Escape')
    await answer
  })

  it('Tab은 두 버튼 안에서만 돈다', async () => {
    // 목록 카드로 새어 나가면 보이지도 않는 곳에 초점이 가 있게 된다.
    const answer = askToDelete('장보기')
    press('Tab')
    expect(document.activeElement).toBe(deleteButton())
    press('Tab')
    expect(document.activeElement).toBe(cancelButton())
    press('Escape')
    await answer
  })

  it('물어보기 전에 보던 자리로 초점이 돌아온다', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const answer = askToDelete('장보기')
    cancelButton().click()
    await answer

    expect(document.activeElement).toBe(trigger)
  })
})
