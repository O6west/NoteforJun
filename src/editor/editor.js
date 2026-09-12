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
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })
}
