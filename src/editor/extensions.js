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

import { t } from '../lib/i18n.js'
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
 * 할 일 항목에서 Enter를 누르면 목록 밖으로 나온다.
 *
 * 기본 동작은 다음 체크박스를 자동으로 만들어 주는 것이다. 편하지만
 * 체크박스가 어떻게 생기는지를 손이 배우지 못한다 — 정작 [] 를 쳐야 하는
 * 자리에서 무엇을 쳐야 할지 모르게 된다. 하나 더 만들려면 [] 를 다시 친다.
 *
 * 항목을 쪼갠 뒤 곧바로 들어내는 것은, 그렇게 해야 커서 뒤에 남은 글자도
 * 함께 빠져나오기 때문이다. 그냥 들어내면 지금 항목이 통째로 문단이 된다.
 */
const TaskItemThatEndsOnEnter = TaskItem.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: () => {
        // 한 체인 안에서 splitListItem 다음에 liftListItem을 이으면, liftListItem이
        // split 전 위치를 보고 판단해 들어내기를 실패한다(항목이 하나 더 남는다).
        // 그래서 두 트랜잭션으로 나눠 순서대로 적용한다.
        this.editor.commands.splitListItem(this.name)
        return this.editor.commands.liftListItem(this.name)
      },
    }
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
    TaskItemThatEndsOnEnter.configure({ nested: false }),
    Bold,
    Italic,
    Underline,
    Highlight.configure({ multicolor: false }),
    History,
    Placeholder.configure({ placeholder: t.bodyPlaceholder }),
  ]
}
