import { wrappingInputRule } from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import History from '@tiptap/extension-history'
import Italic from '@tiptap/extension-italic'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'

import { TASK_INPUT_RULE } from './rules.js'

/**
 * 기본 입력 규칙(`[ ] `, `[x] `)을 우리 규칙(`- `, `[] `)으로 갈아끼운다.
 * wrappingInputRule은 taskList로 감싸는 데 필요한 taskItem을 스키마에서 알아서 찾아 넣는다.
 */
const TaskListWithOurRules = TaskList.extend({
  addInputRules() {
    return [wrappingInputRule({ find: TASK_INPUT_RULE, type: this.type })]
  },
})

/**
 * 이 목록이 지원 서식의 전부다. 여기 없는 것은 동작하지 않는다.
 * 글머리표, 인용구, 코드블록, 링크, 이미지, 취소선은 의도적으로 빠져 있다.
 */
export function buildExtensions() {
  return [
    Document,
    Paragraph,
    Text,
    Heading.configure({ levels: [1] }),
    TaskListWithOurRules,
    TaskItem.configure({ nested: false }),
    Bold,
    Italic,
    Underline,
    Highlight.configure({ multicolor: false }),
    History,
    Placeholder.configure({ placeholder: '여기에 메모…' }),
  ]
}
