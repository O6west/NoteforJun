import { Editor } from '@tiptap/core'

import { buildExtensions } from './extensions.js'

/**
 * @param {object} options
 * @param {HTMLElement} options.element  에디터를 붙일 DOM
 * @param {string} options.content       저장돼 있던 HTML (없으면 빈 문자열)
 * @param {(html: string) => void} options.onUpdate  내용이 바뀔 때마다 호출
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
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })
}
