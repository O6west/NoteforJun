import { describe, expect, it } from 'vitest'
import { DICTS, dictFor, languageFrom } from './i18n.js'

// 표본은 한글이 아닌 것으로 넣는다. 자리표시자에 넣은 한글을 번역 누락으로 오인한다.
const textOf = (value) => (typeof value === 'function' ? value('Groceries') : value)

describe('문구', () => {
  it('두 사전의 키가 정확히 같다', () => {
    // 한쪽에만 있는 키는 그 언어에서 undefined가 되어 화면에 빈칸으로 뜬다.
    // 번역을 빠뜨렸을 때 여기서 걸리라고 있는 테스트다.
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.ko).sort())
  })

  it('영어 사전에 한글이 남아 있지 않다', () => {
    // 옮기다 만 문구를 잡는다. 키는 옮겼는데 값은 한국어 그대로인 경우가
    // 눈으로는 잘 안 보인다 — 한국어 화면에서 테스트를 돌리면 더 그렇다.
    for (const [key, value] of Object.entries(DICTS.en)) {
      expect(/[가-힣]/.test(textOf(value)), `en.${key} = ${textOf(value)}`).toBe(false)
    }
  })

  it('빈 문구가 없다', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(textOf(value), `${lang}.${key}`).toBeTruthy()
      }
    }
  })

  it('한국어 컴퓨터에서만 한국어를 쓴다', () => {
    expect(dictFor('ko')).toBe(DICTS.ko)
    expect(dictFor('ko-KR')).toBe(DICTS.ko)
    expect(dictFor('KO-kr')).toBe(DICTS.ko)
  })

  it('나머지는 전부 영어로 간다', () => {
    // 언어를 못 읽는 경우까지 영어로 보낸다. 빈 화면보다는 낫다.
    for (const lang of ['en-US', 'ja-JP', 'de', 'zh-CN', '', null, undefined]) {
      expect(dictFor(lang), String(lang)).toBe(DICTS.en)
    }
  })

  it('언어는 창 주소가 정하고, 없으면 브라우저 설정으로 물러선다', () => {
    // 창을 만든 Rust가 ?lang= 으로 넘겨준다. 화면이 따로 판단하면
    // Rust가 만든 안내 메모와 언어가 어긋날 수 있다.
    expect(languageFrom('?id=x&lang=ko', 'en-US')).toBe('ko')
    expect(languageFrom('?id=x&lang=en', 'ko-KR')).toBe('en')
    expect(languageFrom('?id=x', 'ko-KR')).toBe('ko-KR')
    expect(languageFrom('', 'ko-KR')).toBe('ko-KR')
    expect(languageFrom(undefined, 'ko-KR')).toBe('ko-KR')
  })

  it('삭제 확인 문구에 메모 이름이 들어간다', () => {
    for (const dict of Object.values(DICTS)) {
      expect(dict.deleteNote('장보기')).toContain('장보기')
      expect(dict.deleteConfirm('장보기')).toContain('장보기')
    }
  })
})
