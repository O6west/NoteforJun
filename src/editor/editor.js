import { Editor } from '@tiptap/core'

import { buildExtensions } from './extensions.js'

/**
 * @param {object} options
 * @param {HTMLElement} options.element  에디터를 붙일 DOM
 * @param {string} options.content       저장돼 있던 HTML (없으면 빈 문자열)
 * @param {() => void} options.onUpdate  내용이 바뀔 때마다 호출 (신호만, 본문은 넘기지 않는다)
 * @returns {Editor}
 */
export function createEditor({ element, content = '', onUpdate = () => {} }) {
  return new Editor({
    element,
    content,
    extensions: buildExtensions(),
    editorProps: {
      attributes: {
        // 맞춤법 검사를 끈다. 한글에서는 멀쩡한 문장에도 빨간 줄이 잔뜩 그어져
        // 메모가 지저분해 보이기만 하고, 고쳐주는 것도 없다.
        spellcheck: 'false',
      },
    },
    // 본문을 여기서 읽지 않는다. 한글은 조합 중에도 자모마다 이 콜백이 도는데,
    // 매번 문서 전체를 HTML로 직렬화하면 메모가 길수록 그 비용이 IME 조합
    // 타이밍을 밀어낸다. 읽는 일은 저장하는 쪽이 저장 직전에 한 번만 한다.
    onUpdate: () => onUpdate(),
  })
}
