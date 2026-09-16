/**
 * 화면에 보이는 문구. OS 언어에 따라 고른다.
 *
 * 언어를 고르는 화면은 만들지 않는다. 설정 화면을 만들지 않는다는 원칙도
 * 있지만, 그보다 먼저 사람은 자기 컴퓨터 언어로 쓰고 싶어한다 — 이미 정해둔
 * 답을 다시 묻는 셈이다.
 *
 * 한국어가 아니면 전부 영어로 간다. 세 번째 언어가 생기기 전까지는 이 규칙으로
 * 충분하고, 그때 가서 늘리면 된다.
 *
 * 개발자에게만 보이는 console.error 메시지는 여기 넣지 않는다. 그건 사용자가
 * 읽는 글이 아니라 우리가 읽는 글이다.
 */
const ko = {
  // 상단바
  dragHandle: '끌어서 옮기기',
  newNote: '새 메모 (Ctrl+Alt+N)',
  titlePlaceholder: '제목',
  pin: '고정',
  pinOff: '항상 위에 고정',
  pinOn: '고정 해제',
  help: '도움말',
  menu: '메뉴',
  close: '닫기',

  // ⋯ 메뉴
  openList: '모든 메모 보기',
  autostart: '윈도우 켤 때 실행',
  updateTo: (version) => `${version} 버전으로 업데이트`,
  updating: '내려받는 중…',

  // 본문
  bodyPlaceholder: '여기에 메모…',

  // 서식 팝업
  formatToolbar: '서식',
  bold: '굵게 (Ctrl+B)',
  italic: '기울임 (Ctrl+I)',
  underline: '밑줄 (Ctrl+U)',
  highlight: '형광펜',

  // ? 도움말
  helpTask: '☐ 할 일',
  helpHeading: '제목',
  helpNewNote: '새 메모',

  // 저장·불러오기 실패
  saveFailed: '저장하지 못했습니다. 창을 닫지 말고 글을 복사해 두세요.',
  saveFailedClosing:
    '저장하지 못했습니다. 글을 복사해 두세요. ×를 한 번 더 누르면 저장하지 않고 닫습니다.',
  loadFailedBody: '이 메모를 불러오지 못했습니다. 파일이 손상되었을 수 있습니다.',
  loadFailed: '메모를 불러오지 못했습니다.',

  // 목록 창
  listWindowTitle: '모든 메모',
  search: '검색',
  noNotes: '메모가 없습니다.',
  noMatch: '찾는 메모가 없습니다.',
  emptyNote: '(빈 메모)',
  untitledNote: '제목 없는 메모',
  deleteNote: (label) => `"${label}" 삭제`,
  deleteConfirm: (label) => `"${label}" 메모를 삭제할까요?\n되돌릴 수 없습니다.`,
  cancel: '취소',
  deleteAction: '삭제',
  deleteFailed: '메모를 지우지 못했습니다.',
  openFailed: '메모를 열지 못했습니다.',
  listFailed: '메모 목록을 불러오지 못했습니다.',
  createFailed: '새 메모를 만들지 못했습니다.',
}

const en = {
  // 상단바
  dragHandle: 'Drag to move',
  newNote: 'New note (Ctrl+Alt+N)',
  titlePlaceholder: 'Title',
  pin: 'Pin',
  pinOff: 'Keep on top',
  pinOn: 'Unpin',
  help: 'Help',
  menu: 'Menu',
  close: 'Close',

  // ⋯ 메뉴
  openList: 'All notes',
  autostart: 'Start with Windows',
  updateTo: (version) => `Update to ${version}`,
  updating: 'Downloading…',

  // 본문
  bodyPlaceholder: 'Write here…',

  // 서식 팝업
  formatToolbar: 'Formatting',
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  highlight: 'Highlight',

  // ? 도움말
  helpTask: '☐ To-do',
  helpHeading: 'Heading',
  helpNewNote: 'New note',

  // 저장·불러오기 실패
  saveFailed: 'Could not save. Keep this window open and copy your text.',
  saveFailedClosing:
    'Could not save. Copy your text. Press × again to close without saving.',
  loadFailedBody: 'Could not open this note. The file may be damaged.',
  loadFailed: 'Could not open this note.',

  // 목록 창
  listWindowTitle: 'All notes',
  search: 'Search',
  noNotes: 'No notes yet.',
  noMatch: 'No notes match.',
  emptyNote: '(Empty note)',
  untitledNote: 'Untitled note',
  deleteNote: (label) => `Delete "${label}"`,
  deleteConfirm: (label) => `Delete "${label}"?\nThis cannot be undone.`,
  cancel: 'Cancel',
  deleteAction: 'Delete',
  deleteFailed: 'Could not delete the note.',
  openFailed: 'Could not open the note.',
  listFailed: 'Could not load the note list.',
  createFailed: 'Could not create a new note.',
}

export const DICTS = { ko, en }

/** 언어 코드에 맞는 사전. 알 수 없으면 영어로 간다. */
export function dictFor(language) {
  return String(language ?? '').toLowerCase().startsWith('ko') ? ko : en
}

/**
 * 어느 언어로 쓸지는 창을 만든 Rust가 정해 주소에 실어 보낸다(`?lang=ko`).
 *
 * 화면이 navigator.language를 따로 읽지 않는 이유는, 그러면 언어를 두 곳에서
 * 판단하게 되기 때문이다. 윈도우에는 표시 언어와 지역 형식이 따로 있어서 둘을
 * 다르게 맞춰둔 사람에게는 화면은 영어인데 안내 메모만 한국어로 뜰 수 있었다.
 * 한 사실을 두 곳에서 판단하면 언젠가 어긋난다.
 *
 * 주소에 없으면(테스트처럼 창 없이 불러올 때) 브라우저 설정으로 물러선다.
 */
export function languageFrom(search, navigatorLanguage) {
  return new URLSearchParams(search ?? '').get('lang') ?? navigatorLanguage
}

export const t = dictFor(
  languageFrom(globalThis.location?.search, globalThis.navigator?.language),
)
