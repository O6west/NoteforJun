# NoteforJun 사용성 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1을 쓰면서 나온 수정 요청 7건을 고친다 — 항상 위 고정, 글자 크기, 한글 입력 지연, 이동 손잡이, 재시작 복원, `?` 도움말, 서식 팝업 Tab.

**Architecture:** 새 구조를 만들지 않는다. 기존 파일 7개를 고치고 새 파일은 도움말 모듈 하나(`src/lib/help.js`)만 만든다. 복원 규칙은 지금처럼 순수 함수(`startup_plan`)로 유지해 파일 시스템 없이 테스트한다. 도움말은 `resize.js`의 선례를 따라 `src/lib/`에 둔다 — `lib`는 이미 DOM을 만드는 UI 헬퍼를 담고 있다.

**Tech Stack:** Tauri v2 (Rust), TipTap 2 / ProseMirror, Vite, Vitest + jsdom, 순수 CSS

**선행 문서:** [2026-09-13-noteforjun-usability-design.md](../specs/2026-09-13-noteforjun-usability-design.md)

## Global Constraints

- 주석과 커밋 메시지는 한국어로 쓴다. 기존 코드의 주석 밀도와 어투를 따른다 — "무엇을"이 아니라 "왜"를 적는다.
- 요청된 줄만 고친다. 지나가는 길의 리팩터링·서식 정리·주석 추가를 하지 않는다.
- 기존 테스트는 전부 그대로 통과해야 한다. 규칙이 바뀌어 의미가 달라진 테스트만 교체한다.
- JS 테스트: `npm test` (vitest run, `src/**/*.test.js`)
- Rust 테스트: `cargo test --manifest-path src-tauri/Cargo.toml`
- 창 최소 폭은 220px이다. 상단바와 팝업의 모든 치수는 이 폭에서 깨지지 않아야 한다.
- 복원 상한은 5개(`MAX_RESTORE`). 설정으로 빼지 않는다.
- 커밋 메시지 끝에 다음 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
  ```

---

## File Structure

| 파일 | 책임 | 이번 변경 |
|---|---|---|
| `src-tauri/src/windows.rs` | 창 생성·복원 규칙 | 복원 규칙 교체, 항상 위 고정 |
| `src/editor/editor.js` | TipTap 편집기 생성 | `onUpdate`를 신호로만 |
| `src/note.js` | 메모 창 조립 | 저장 직전에 본문을 직렬화 |
| `src/editor/bubble.js` | 서식 팝업 | 본문 → 팝업 Tab 인계 |
| `src/lib/help.js` **(신규)** | `?` 도움말 팝업 | 새로 만듦 |
| `src/note.html` | 메모 창 뼈대 | `?` 버튼 추가 |
| `src/styles/tokens.css` | 색·치수 토큰 | 본문 글자 크기 |
| `src/styles/note.css` | 메모 창 스타일 | 손잡이 치수, 도움말 스타일 |

---

## Task 1: 재시작 복원 규칙 교체

**Files:**
- Modify: `src-tauri/src/windows.rs:28-55` (`Startup`, `startup_plan`), `:162-191` (`restore_all`, `open_blank`, `blank_ids`), `:232-316` (테스트)

**Interfaces:**
- Consumes: `crate::note::Note`, `windows::is_blank(&Note) -> bool`
- Produces:
  - `pub struct Candidate { pub id: String, pub was_visible: bool, pub blank: bool, pub updated_at: String }`
  - `pub const MAX_RESTORE: usize = 5`
  - `pub fn startup_plan(candidates: Vec<Candidate>) -> Startup`
  - `pub fn blank_plan(blank: Vec<String>) -> Startup`
  - `impl From<&Note> for Candidate`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src-tauri/src/windows.rs`의 `mod tests` 안에서, 기존 테스트 중 규칙이 바뀐 네 개(`nothing_to_show_creates_a_blank_note`, `visible_notes_are_restored`, `all_hidden_reuses_an_existing_blank_note`, `visible_notes_win_over_a_blank_one`)를 아래로 **교체**한다. 나머지 테스트(`first_window_is_centered`, `next_window_cascades_down_right`, `wraps_to_top_left_when_off_right_edge`, `wraps_to_top_left_when_off_bottom_edge`, `blank_means_no_title_and_no_body_text`, `label_is_prefixed`)는 건드리지 않는다.

```rust
    fn cand(id: &str, was_visible: bool, blank: bool, updated_at: &str) -> Candidate {
        Candidate {
            id: id.to_string(),
            was_visible,
            blank,
            updated_at: updated_at.to_string(),
        }
    }

    fn ids(plan: Startup) -> Vec<String> {
        match plan {
            Startup::Restore(ids) => ids,
            Startup::NewNote => panic!("빈 메모를 만들 자리가 아니다"),
        }
    }

    #[test]
    fn nothing_to_show_creates_a_blank_note() {
        // 메모가 아예 없을 때와, 있는 메모가 전부 빈 메모일 때가 같은 결과로 모인다.
        // 둘 다 아무것도 안 띄우면 앱에 닿을 수 없게 된다 — 창 테두리도 트레이도 없다.
        assert_eq!(startup_plan(vec![]), Startup::NewNote);
        assert_eq!(
            startup_plan(vec![cand("a", true, true, "2026-09-13T00:00:00Z")]),
            Startup::NewNote
        );
    }

    #[test]
    fn blank_notes_are_never_restored() {
        let plan = startup_plan(vec![
            cand("blank", true, true, "2026-09-13T09:00:00Z"),
            cand("written", false, false, "2026-09-13T08:00:00Z"),
        ]);
        assert_eq!(ids(plan), vec!["written".to_string()]);
    }

    #[test]
    fn notes_on_screen_come_first() {
        // 오래됐어도 화면에 떠 있던 메모가 상한 자리를 먼저 차지한다.
        let plan = startup_plan(vec![
            cand("fresh", false, false, "2026-09-13T09:00:00Z"),
            cand("on-screen", true, false, "2026-09-01T00:00:00Z"),
        ]);
        assert_eq!(ids(plan), vec!["on-screen".to_string(), "fresh".to_string()]);
    }

    #[test]
    fn hidden_notes_are_ordered_by_recency() {
        let plan = startup_plan(vec![
            cand("old", false, false, "2026-09-01T00:00:00Z"),
            cand("new", false, false, "2026-09-13T00:00:00Z"),
        ]);
        assert_eq!(ids(plan), vec!["new".to_string(), "old".to_string()]);
    }

    #[test]
    fn restores_at_most_five() {
        // 메모는 계속 쌓인다. 상한이 없으면 언젠가 부팅할 때 창 수십 개가 한꺼번에 뜬다.
        let many: Vec<Candidate> = (0..9)
            .map(|i| cand(&format!("n{i}"), false, false, &format!("2026-09-{:02}T00:00:00Z", i + 1)))
            .collect();
        assert_eq!(ids(startup_plan(many)).len(), MAX_RESTORE);
    }

    #[test]
    fn taskbar_click_reuses_an_existing_blank_note() {
        // 매번 새로 만들면 아이콘을 누를 때마다 빈 메모가 쌓인다
        assert_eq!(
            blank_plan(vec!["blank".to_string()]),
            Startup::Restore(vec!["blank".to_string()])
        );
        assert_eq!(blank_plan(vec![]), Startup::NewNote);
    }
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: FAIL — `cannot find type 'Candidate' in this scope`, `cannot find function 'blank_plan'`, `startup_plan` 인자 개수 불일치

- [ ] **Step 3: 규칙을 구현한다**

`src-tauri/src/windows.rs:37-55`의 `startup_plan`과 그 문서 주석을 아래로 **통째로 교체**한다.

```rust
/// 한 번에 되살릴 메모의 최대 개수.
///
/// 메모는 계속 쌓인다. 상한이 없으면 지금은 아홉 개, 한 달 뒤엔 수십 개의 창이
/// 부팅할 때 한꺼번에 뜬다. 책상을 돌려놓자는 것이지 어지르자는 것이 아니다.
pub const MAX_RESTORE: usize = 5;

/// 되살릴지 판단하는 데 필요한 것만 추린 메모 한 건.
/// startup_plan을 파일 시스템에서 떼어내기 위해 있다.
#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub id: String,
    /// 앱이 마지막으로 켜져 있을 때 화면에 떠 있었는가
    pub was_visible: bool,
    /// 제목도 본문도 비어 있는가
    pub blank: bool,
    /// ISO 8601. 앞자리부터 자릿수가 고정돼 있어 문자열 비교가 곧 시간순이다.
    pub updated_at: String,
}

impl From<&Note> for Candidate {
    fn from(n: &Note) -> Self {
        Self {
            id: n.id.clone(),
            was_visible: n.window.visible,
            blank: is_blank(n),
            updated_at: n.updated_at.clone(),
        }
    }
}

/// 켜질 때 무엇을 띄울지 정한다.
///
/// 내용이 있는 메모를 [화면에 떠 있던 것 먼저, 그다음 최근 수정순]으로
/// 최대 MAX_RESTORE개까지 띄운다.
///
/// × 로 닫은 메모도 최근 다섯 개 안에 들면 돌아온다. × 는 "잠깐 치우기"이지
/// "그만 보기"가 아니기 때문이다. 화면에 떠 있던 메모를 앞세우는 것은,
/// 재시작 직전의 책상이 그중 가장 확실한 단서이기 때문이다.
///
/// 빈 메모를 빼는 이유는 되살려봐야 사용자가 얻을 것이 없어서다. 다만
/// 아무것도 안 띄우는 선택지는 없다 — 메모 창에는 OS 테두리가 없고 트레이
/// 아이콘도 쓰지 않으므로, 창이 하나도 없으면 앱은 켜져 있는데 닿을 방법이 없다.
pub fn startup_plan(candidates: Vec<Candidate>) -> Startup {
    let mut keep: Vec<Candidate> = candidates.into_iter().filter(|c| !c.blank).collect();
    keep.sort_by(|a, b| {
        b.was_visible
            .cmp(&a.was_visible)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
    });
    keep.truncate(MAX_RESTORE);
    if keep.is_empty() {
        return Startup::NewNote;
    }
    Startup::Restore(keep.into_iter().map(|c| c.id).collect())
}

/// 작업표시줄 아이콘을 눌렀을 때 무엇을 띄울지.
/// 이미 비어 있는 메모가 있으면 그것을 다시 띄운다 — 매번 새로 만들면 빈 메모가 쌓인다.
pub fn blank_plan(blank: Vec<String>) -> Startup {
    match blank.into_iter().next() {
        Some(id) => Startup::Restore(vec![id]),
        None => Startup::NewNote,
    }
}
```

이어서 `restore_all`(`:162-170`)의 본문과 `open_blank`(`:176-179`)의 본문을 바꾼다. 두 함수의 문서 주석 중 `restore_all` 쪽만 새 규칙에 맞게 고치고, `open_blank`의 주석은 그대로 둔다.

```rust
/// 앱을 켤 때 호출한다.
///
/// 내용이 있는 메모를 최대 MAX_RESTORE개까지 되살린다 — 책상을 원래대로
/// 돌려놓는 일이다. 되살릴 게 없으면 적을 수 있는 빈 메모를 내민다.
pub fn restore_all(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    let candidates: Vec<Candidate> = notes.iter().map(Candidate::from).collect();
    apply(app, notes_dir, &notes, startup_plan(candidates))
}
```

```rust
pub fn open_blank(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    apply(app, notes_dir, &notes, blank_plan(blank_ids(&notes)))
}
```

`blank_ids`와 `apply`, `load_all`, `is_blank`는 그대로 둔다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS — `windows::tests` 11개 전부 통과, 경고 없음

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/windows.rs
git commit -F - <<'EOF'
feat: 재시작할 때 내용 있는 메모를 최대 다섯 개까지 되살린다

지금까지는 화면에 떠 있던 메모만 되살렸다. 그런데 × 는 "잠깐 치우기"로
쓰이지 "그만 보기"로 쓰이지 않는다. 저장된 메모 열 건 중 여덟 건이
visible=false 였고, 그래서 재시작하면 빈 메모 한 장만 떴다.

내용이 있는 메모를 [떠 있던 것 먼저, 그다음 최근 수정순]으로 다섯 개까지
되살린다. 빈 메모는 빼고, 되살릴 게 없을 때만 빈 메모를 내민다.

상한을 두는 이유는 메모가 계속 쌓이기 때문이다. 상한이 없으면 언젠가
부팅할 때 창 수십 개가 한꺼번에 뜬다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 2: 메모 창 항상 위 고정

**Files:**
- Modify: `src-tauri/src/windows.rs:100-117` (`open_note`의 빌더)

**Interfaces:**
- Consumes: Task 1이 바꾼 `windows.rs` (충돌 없음 — 다른 함수다)
- Produces: 없음 (동작 변경만)

자동 테스트가 없다. Tauri 창 빌더의 결과는 실제 창이 떠야 확인되고, 이 저장소에는 Tauri 통합 테스트 장치가 없다. Task 7의 실제 앱 확인으로 검증한다.

- [ ] **Step 1: 빌더에 한 줄 더한다**

`src-tauri/src/windows.rs`에서 `open_note` 안의 `.resizable(true)` 바로 다음 줄에 넣는다.

```rust
        .resizable(true)
        // 다른 프로그램을 클릭해도 메모는 앞에 남는다. 포스트잇으로 쓰는 앱인데
        // 뒤로 숨으면 볼 때마다 찾아와야 한다. 끄는 길은 두지 않는다 — 항상
        // 보이는 것이 이 앱의 전제다. 넓은 목록 창(open_list)은 그대로 둔다.
        .always_on_top(true)
```

- [ ] **Step 2: 빌드되는지 확인한다**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: 성공, 경고 없음

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인한다**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS — Task 1에서 통과하던 것과 같은 개수

- [ ] **Step 4: 커밋**

```bash
git add src-tauri/src/windows.rs
git commit -F - <<'EOF'
feat: 메모 창을 항상 위에 고정

다른 프로그램을 클릭하면 메모가 뒤로 숨어서, 볼 때마다 찾아와야 했다.

목록 창은 제외한다. 넓어서 항상 위에 있으면 화면을 계속 덮는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 3: 타이핑할 때마다 본문을 직렬화하지 않는다

**Files:**
- Modify: `src/editor/editor.js:5-25` (JSDoc과 `onUpdate`)
- Modify: `src/note.js:88-92` (`persist`), `:165-172` (`createEditor` 호출)
- Test: `src/editor/editor.test.js` (맨 끝에 `describe` 추가)

**Interfaces:**
- Consumes: `createEditor({ element, content, onUpdate })`
- Produces: `onUpdate`의 타입이 `(html: string) => void` 에서 **`() => void`** 로 바뀐다. 본문을 읽는 책임은 부르는 쪽으로 간다.

설계 문서 2.3은 "조합 중에는 건너뛰고 끝난 뒤 한 번"이라고 적었지만, 더 단순하고 더 안전한 길이 있다. **조합 상태를 보지 않고, 직렬화 자체를 저장 시점으로 미룬다.** 타이핑은 신호만 보내고 타이머를 되돌리며, 실제 `getHTML()`은 저장 직전에 한 번 돈다. `compositionend` 시점에 ProseMirror가 문서를 이미 반영했는지 추측할 필요가 없어지고, 마지막 글자를 잃을 경로가 아예 사라진다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/editor/editor.test.js` 맨 끝에 붙인다.

```js
describe('저장 신호', () => {
  it('글자를 칠 때마다 알리되, 본문을 직렬화해 넘기지는 않는다', () => {
    // 직렬화는 저장하는 쪽이 저장 직전에 한 번만 한다.
    // 한글은 조합 중에도 자모마다 문서가 바뀌어서 '가' 한 글자에 두 번 불린다.
    // 여기서 매번 getHTML()을 하면 메모가 길어질수록 그 비용이 IME 조합
    // 타이밍을 밀어내고, 글자가 한 박자 늦게 들어간다.
    const calls = []
    const el = document.createElement('div')
    document.body.appendChild(el)
    const ed = createEditor({ element: el, content: '', onUpdate: (...args) => calls.push(args) })

    typeText(ed, '가나다')

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((args) => args.length === 0)).toBe(true)

    ed.destroy()
    el.remove()
  })
})
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `npm test -- src/editor/editor.test.js`
Expected: FAIL — `expected false to be true` (지금은 `onUpdate(editor.getHTML())`로 인자를 하나 넘긴다)

- [ ] **Step 3: 편집기에서 직렬화를 걷어낸다**

`src/editor/editor.js`를 아래로 **통째로 교체**한다.

```js
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
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `npm test -- src/editor/editor.test.js`
Expected: PASS — `editor.test.js` 전부 통과

- [ ] **Step 5: 저장하는 쪽이 본문을 읽게 한다**

`src/note.js:88-92`의 `persist`를 바꾼다.

```js
/**
 * 저장하는 유일한 통로. 성공하면 표시를 띄우고, 실패하면 경고를 남긴다.
 *
 * 본문을 여기서 읽는 이유는, 이곳이 모든 저장 경로가 반드시 지나는 한 지점이기
 * 때문이다. 타이핑·제목·색·창 이동·닫기 직전 flush가 전부 여기로 모이므로,
 * 어느 경로로 들어와도 저장되는 것은 지금 화면에 있는 그대로다.
 */
function persist() {
  if (!note) return Promise.resolve()
  if (editor) note.content = editor.getHTML()
  return saveInOrder(note).then(flashSaved, showSaveError)
}
```

이어서 `src/note.js:165-172`의 `createEditor` 호출에서 `onUpdate`를 바꾼다.

```js
  editor = createEditor({
    element: document.getElementById('editor'),
    content: note.content,
    onUpdate: () => saver.call(),
  })
```

`const saver = debounce(() => persist(), SAVE_DELAY)`(`:94`)는 건드리지 않는다.

- [ ] **Step 6: 전체 테스트가 통과하는 것을 확인한다**

Run: `npm test`
Expected: PASS — 모든 테스트 파일 통과

- [ ] **Step 7: 커밋**

```bash
git add src/editor/editor.js src/editor/editor.test.js src/note.js
git commit -F - <<'EOF'
perf: 타이핑할 때마다 본문을 직렬화하지 않는다

글자 하나 칠 때마다 문서 전체를 HTML 문자열로 만들고 있었다. 한글은
조합 중에도 자모마다 문서가 바뀌므로 '가' 한 글자에 두 번 돌았다.
메모가 길어질수록 이 비용이 IME 조합 타이밍을 밀어낸다 — 좌상단에 작은
조합창이 뜨고 글자가 한 박자 늦게 들어가는 증상의 유력한 유발 요인이다.

이제 타이핑은 신호만 보내고, 직렬화는 저장 직전에 persist()에서 한 번만
한다. 모든 저장 경로가 persist()를 지나므로 어느 길로 들어와도 저장되는
것은 지금 화면에 있는 그대로다.

조합 상태를 보고 건너뛰는 방법도 있었지만 쓰지 않았다. compositionend
시점에 ProseMirror가 문서를 반영했는지 추측해야 하고, 틀리면 마지막 글자를
잃는다. 직렬화를 미루면 그 경로가 아예 없어진다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 4: 본문에서 서식 팝업으로 Tab 인계

**Files:**
- Modify: `src/editor/bubble.js:13`(시그니처 아님, 본문 내부), `:131-144` (리스너 등록과 `destroy`)
- Test: `src/editor/bubble.test.js` (`키보드로 쓰기` describe 안)

**Interfaces:**
- Consumes: `createBubble({ editor, container })`, `editor.view.dom`
- Produces: 변화 없음 — 반환값(`{ element, update, destroy }`)은 그대로다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/editor/bubble.test.js`의 `describe('키보드로 쓰기', ...)` 안, `'마지막 버튼에서 Tab을 누르면 처음 버튼으로 돌아온다'` **앞에** 넣는다.

```js
  it('본문에서 Tab을 누르면 팝업 첫 버튼으로 들어간다', () => {
    // 이 인계가 없으면 브라우저 기본 탭 순서에 맡기게 된다. 팝업이 #shell 맨 끝에
    // 붙어 있어서 "우연히" 본문 다음 차례가 되는 구조라, DOM 순서가 바뀌거나
    // WebView2의 탭 처리가 다르면 조용히 깨진다.
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    editor.view.dom.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(bubble.element.querySelector('[data-mark="bold"]'))
  })

  it('본문에서 Shift+Tab은 가로채지 않는다 (상단바로 올라가야 한다)', () => {
    const e = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.view.dom.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(false)
  })
```

이어서 같은 파일의 `describe('드래그 팝업', ...)` 안, `'선택이 없으면 숨어 있다'` **뒤에** 넣는다.

```js
  it('팝업이 숨어 있으면 본문 Tab을 가로채지 않는다', () => {
    bubble.update()
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    editor.view.dom.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(false)
  })
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `npm test -- src/editor/bubble.test.js`
Expected: FAIL — `'본문에서 Tab을 누르면 팝업 첫 버튼으로 들어간다'`가 `expected false to be true`

(`'본문에서 Shift+Tab은…'`과 `'팝업이 숨어 있으면…'`은 지금도 통과한다. 고친 뒤에도 통과해야 하는 울타리다.)

- [ ] **Step 3: 인계를 구현한다**

`src/editor/bubble.js`에서 `const onKeyDown = (e) => {` 정의 **앞에** 넣는다.

```js
  /**
   * 본문에서 Tab을 누르면 팝업 첫 버튼으로 보낸다.
   *
   * 팝업 안에서 버튼 사이를 도는 것(onKeyDown)은 원래 있었는데, 그 앞 단계인
   * 본문 → 팝업 인계가 브라우저 기본 탭 순서에 맡겨져 있었다. 팝업이 #shell
   * 맨 끝에 붙어 있어서 "우연히" 본문 다음 차례가 되는 구조다. 명시적으로 잇는다.
   *
   * Shift+Tab은 가로채지 않는다. 뒤로 가는 길은 상단바로 올라가는 것이 맞다.
   */
  const onEditorKeyDown = (e) => {
    if (e.key !== 'Tab' || e.shiftKey || element.hidden) return
    const first = element.querySelector('button')
    if (!first) return
    e.preventDefault()
    first.focus()
  }
```

이어서 `element.addEventListener('keydown', onKeyDown)`(`:131`) **다음 줄**에 넣는다.

```js
  editor.view.dom.addEventListener('keydown', onEditorKeyDown)
```

이어서 `destroy()`(`:138-143`) 안의 `element.removeEventListener('keydown', onKeyDown)` **다음 줄**에 넣는다.

```js
      editor.view.dom.removeEventListener('keydown', onEditorKeyDown)
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `npm test -- src/editor/bubble.test.js`
Expected: PASS — `bubble.test.js` 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/editor/bubble.js src/editor/bubble.test.js
git commit -F - <<'EOF'
fix: 본문에서 서식 팝업으로 Tab이 들어가게

글자를 끌어 팝업이 떠도 Tab을 누르면 밖으로 나가버렸다.

팝업 안에서 버튼 사이를 도는 코드는 원래 있었고 테스트도 통과했다.
빠진 것은 그 앞 단계, 본문에서 팝업으로 들어가는 첫 Tab이었다. 그걸
브라우저 기본 탭 순서에 맡기고 있었는데, 팝업이 #shell 맨 끝에 붙어
있어서 "우연히" 본문 다음 차례가 되는 구조였다.

이제 본문 → 팝업 첫 버튼 → (순환) → Esc로 복귀가 모두 명시적이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 5: `?` 도움말

**Files:**
- Create: `src/lib/help.js`
- Create: `src/lib/help.test.js`
- Modify: `src/note.html:13-14` (상단바에 버튼 추가)
- Modify: `src/note.js:8` 부근 (import), `:173` 부근 (`createBubble` 다음)
- Modify: `src/styles/note.css` (맨 끝에 스타일 추가)

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces: `createHelp({ button, container }) -> { element, destroy }`
  - `button`: 도움말을 여는 `HTMLElement`
  - `container`: 팝업을 붙일 `HTMLElement`
  - `element`: 만들어진 팝업 `div#help`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/help.test.js`를 만든다.

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHelp } from './help.js'

let container
let button
let help

beforeEach(() => {
  container = document.createElement('div')
  button = document.createElement('button')
  container.appendChild(button)
  document.body.appendChild(container)
  help = createHelp({ button, container })
})

afterEach(() => {
  help.destroy()
  container.remove()
})

describe('도움말', () => {
  it('처음에는 숨어 있다', () => {
    expect(help.element.hidden).toBe(true)
  })

  it('다섯 가지를 알려준다', () => {
    const keys = [...help.element.querySelectorAll('kbd')].map((k) => k.textContent)
    expect(keys).toEqual([
      '[] 또는 - 다음 스페이스',
      '# 다음 스페이스',
      'Ctrl+B / I / U',
      '글자를 끌면',
      'Ctrl+Alt+N',
    ])
  })

  it('실제로 되는 것만 적혀 있다', () => {
    // rules.js의 TASK_INPUT_RULE이 "[] "와 "- " 둘 다 받는다.
    // 안내에 하나만 적으면 반쪽짜리 문서가 된다.
    const text = help.element.textContent
    expect(text).toContain('[]')
    expect(text).toContain('-')
    expect(text).toContain('할 일')
  })

  it('커서를 올리면 나타나고 치우면 사라진다', () => {
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(help.element.hidden).toBe(false)

    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(help.element.hidden).toBe(true)
  })

  it('Tab으로 초점이 닿아도 나타난다', () => {
    // 이 앱은 제목 → 본문 → 서식 팝업을 Tab으로 잇는다.
    // ?만 마우스 전용이면 그 흐름이 여기서 끊긴다.
    button.dispatchEvent(new FocusEvent('focus'))
    expect(help.element.hidden).toBe(false)

    button.dispatchEvent(new FocusEvent('blur'))
    expect(help.element.hidden).toBe(true)
  })

  it('destroy하면 팝업이 사라진다', () => {
    help.destroy()
    expect(container.querySelector('#help')).toBeNull()
    help = createHelp({ button, container }) // afterEach가 다시 destroy할 수 있게
  })
})
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `npm test -- src/lib/help.test.js`
Expected: FAIL — `Failed to resolve import "./help.js"`

- [ ] **Step 3: 도움말 모듈을 만든다**

`src/lib/help.js`를 만든다.

```js
/**
 * 상단바 ? 도움말.
 *
 * 커서를 올리거나 Tab으로 초점이 닿으면 안내가 뜬다. 키보드로도 열리게 하는
 * 이유는 이 앱이 이미 제목 → 본문 → 서식 팝업을 Tab으로 잇고 있어서,
 * ?만 마우스 전용이면 그 흐름이 거기서 끊기기 때문이다.
 *
 * 브라우저 기본 툴팁(title 속성)을 쓰지 않는 이유는 줄바꿈이 안 되고,
 * 뜨기까지 1초 넘게 걸리며, 키보드 초점으로는 열리지 않아서다.
 */
const LINES = [
  ['[] 또는 - 다음 스페이스', '할 일 박스'],
  ['# 다음 스페이스', '제목'],
  ['Ctrl+B / I / U', '굵게 / 기울임 / 밑줄'],
  ['글자를 끌면', '형광펜 포함 서식 팝업'],
  ['Ctrl+Alt+N', '새 메모'],
]

export function createHelp({ button, container }) {
  const element = document.createElement('div')
  element.id = 'help'
  element.hidden = true
  element.setAttribute('role', 'tooltip')

  // 두 칸짜리 격자로 쌓는다. 칸을 나눠두면 창이 최소 폭(220px)까지 좁아져도
  // 설명만 줄바꿈되고 왼쪽 열은 그대로 줄이 맞는다.
  for (const [key, what] of LINES) {
    const k = document.createElement('kbd')
    k.textContent = key
    const w = document.createElement('span')
    w.textContent = what
    element.append(k, w)
  }
  container.appendChild(element)

  button.setAttribute('aria-describedby', 'help')

  const show = () => {
    element.hidden = false
  }
  const hide = () => {
    element.hidden = true
  }

  button.addEventListener('mouseenter', show)
  button.addEventListener('mouseleave', hide)
  button.addEventListener('focus', show)
  button.addEventListener('blur', hide)

  return {
    element,
    destroy() {
      button.removeEventListener('mouseenter', show)
      button.removeEventListener('mouseleave', hide)
      button.removeEventListener('focus', show)
      button.removeEventListener('blur', hide)
      element.remove()
    },
  }
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `npm test -- src/lib/help.test.js`
Expected: PASS — 6개 전부 통과

- [ ] **Step 5: 상단바에 버튼을 붙인다**

`src/note.html`에서 `<span id="saved" ...>` 와 `<button ... id="menu-btn" ...>` **사이에** 넣는다.

```html
        <button class="bar-btn" id="help-btn" title="도움말">?</button>
```

`src/note.js`의 import 구역에서 `import { debounce } from './lib/debounce.js'` **다음 줄**에 넣는다.

```js
import { createHelp } from './lib/help.js'
```

`src/note.js`의 `createBubble({ editor, container: shell })` **다음 줄**에 넣는다.

```js
  createHelp({ button: document.getElementById('help-btn'), container: shell })
```

- [ ] **Step 6: 스타일을 붙인다**

`src/styles/note.css` 맨 끝에 넣는다.

```css
/*
 * ? 도움말. 서식 팝업(102)보다 위에 둔다 — 둘이 겹칠 일은 드물지만,
 * 겹치면 방금 연 쪽이 보이는 것이 맞다.
 *
 * 좌우를 8px씩 양쪽 다 잡아두는 이유는 창이 최소 폭(220px)까지 좁아져도
 * 밖으로 밀려나지 않게 하기 위해서다. #shell이 overflow: hidden이라
 * 한번 밀려나면 그만큼 잘려서 아예 안 보인다.
 */
#help {
  position: absolute;
  top: calc(var(--nfj-bar-height) + 4px);
  left: 8px;
  right: 8px;
  z-index: 103;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  padding: 9px 11px;
  border-radius: 6px;
  background: #2e2e2c;
  color: #f2f0ea;
  font-size: 12px;
  line-height: 1.5;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  /* 팝업이 마우스를 가로채면 버튼에서 mouseleave가 안 떠서 안 사라진다 */
  pointer-events: none;
}
#help[hidden] { display: none; }
#help kbd { font-family: inherit; opacity: 0.72; }

/*
 * ? 는 + × ⋯ 보다 획이 잘아서, .bar-btn의 20px로 두면 혼자 커 보인다.
 *
 * bar.css가 아니라 여기에 두는 것은 #help-btn이 메모 창에만 있는 버튼이기
 * 때문이다. resize.css가 경고하는 "한 요소의 스타일이 두 파일에 흩어져
 * 불러오는 순서가 승패를 가르는" 경우에는 해당하지 않는다 — id 선택자가
 * .bar-btn의 class 선택자를 명시도로 이기므로 순서와 무관하다.
 */
#help-btn { font-size: 15px; font-weight: 700; }
```

- [ ] **Step 7: 전체 테스트가 통과하는 것을 확인한다**

Run: `npm test`
Expected: PASS — 모든 테스트 파일 통과

- [ ] **Step 8: 커밋**

```bash
git add src/lib/help.js src/lib/help.test.js src/note.html src/note.js src/styles/note.css
git commit -F - <<'EOF'
feat: 상단바에 ? 도움말

[] 가 할 일 박스이고 # 가 제목이라는 것을 알 길이 없었다. 우연히
발견하면 이득인 기능들인데, 우연에만 맡겨두고 있었다.

커서를 올리거나 Tab으로 초점이 닿으면 뜬다. 키보드로도 열리게 한 것은
이 앱이 이미 제목 → 본문 → 서식 팝업을 Tab으로 잇고 있어서, ?만
마우스 전용이면 그 흐름이 거기서 끊기기 때문이다.

title 속성을 쓰지 않은 이유는 줄바꿈이 안 되고, 뜨기까지 1초 넘게
걸리며, 키보드 초점으로는 열리지 않아서다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 6: 본문 글자 크기와 이동 손잡이

**Files:**
- Modify: `src/styles/tokens.css:7`
- Modify: `src/styles/note.css:24-55` (`#grabber` 주석과 규칙)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (치수 변경만)

순수 CSS다. 자동 테스트가 없고 Task 7에서 눈으로 확인한다.

- [ ] **Step 1: 본문 글자 크기를 한 단계 올린다**

`src/styles/tokens.css:7`을 바꾼다.

```css
  --nfj-body-size: 15px;
```

제목(`--nfj-h1-size`), 상단바 제목칸(`--nfj-title-size`), 목록 미리보기(`--nfj-preview-size`)는 건드리지 않는다. 같이 올리면 상단바 높이(34px)와 목록 행 높이가 함께 흔들린다.

- [ ] **Step 2: 손잡이를 키운다**

`src/styles/note.css:24-55`의 주석과 `#grabber` 규칙 세 덩이를 아래로 **통째로 교체**한다.

```css
/*
 * 창을 끌기 위한 손잡이.
 * 제목칸 위에 겹쳐 떠 있어 제목 폭을 전혀 뺏지 않는다. 제목을 20자까지
 * 꽉 채워도 잡을 곳이 사라지지 않는 것이 이 요소가 존재하는 이유다.
 * 보이는 선은 44px이지만 실제로 잡히는 영역은 80×20px로 넉넉히 둔다.
 *
 * 폭을 80px로 멈추는 이유: 제목 위에 겹쳐 있고 cursor: grab을 쓰므로,
 * 넓힌 만큼 제목을 클릭할 수 없는 구간이 된다. 창 최소 폭이 220px이라
 * 96px을 넘기면 제목칸 절반을 잡아먹는다.
 *
 * 높이를 20px로 멈추는 이유: 상단바는 34px이고 그 아래쪽은 어차피
 * #titlebar의 data-tauri-drag-region이 맡고 있어 끌린다. 더 늘려봐야
 * 얻는 것 없이 제목 클릭 영역만 줄어든다.
 */
#grabber {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  /* 크기 조절 영역(100)보다 위. 겹치는 자리에서는 끌기가 먼저 잡혀야 한다. */
  z-index: 101;
  width: 80px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
#grabber:active {
  cursor: grabbing;
}
#grabber i {
  display: block;
  width: 44px;
  height: 4px;
  border-radius: 2px;
  /* 상단바 글자색을 그대로 쓰므로 6색 어디서나 알아서 어울린다 */
  background: currentColor;
  opacity: 0.5;
  transition: opacity 0.12s ease;
}
/* 크기만 키우면 여전히 어디를 노려야 하는지 눈에 안 들어온다.
   커서를 올렸을 때 진해지는 것이 "여기가 잡는 곳"이라는 신호다. */
#grabber:hover i {
  opacity: 0.75;
}
```

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인한다**

Run: `npm test`
Expected: PASS — CSS는 테스트 대상이 아니므로 Task 5와 같은 결과

- [ ] **Step 4: 커밋**

```bash
git add src/styles/tokens.css src/styles/note.css
git commit -F - <<'EOF'
feat: 본문 글자를 한 단계 키우고 이동 손잡이를 크게

본문 14px → 15px. 제목과 상단바, 목록 미리보기는 그대로 둔다 —
같이 올리면 상단바 높이와 목록 행 높이가 함께 흔들린다.

손잡이는 잡히는 영역 56×13 → 80×20, 보이는 선 40×3 → 44×4,
진하기 0.38 → 0.5. 커서를 올리면 0.75로 더 진해진다. 크기만 키우면
여전히 어디를 노려야 하는지 눈에 안 들어오기 때문이다.

폭을 80px에서 멈추는 것은 손잡이가 제목칸 위에 겹쳐 있어서다.
넓힌 만큼 제목을 클릭할 수 없는 구간이 된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012U6cCmqYgdS9Kvk26Ld3gW
EOF
```

---

## Task 7: 실제 앱에서 확인

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~6의 모든 변경

자동 테스트로 확인할 수 없는 것들을 한 번에 몰아서 본다. 작업 중간중간 나누지 않는 이유는, 개발 빌드를 띄우려면 매번 설치본을 끊어야 하기 때문이다.

- [ ] **Step 1: 전체 테스트를 돌린다**

Run: `npm test && cargo test --manifest-path src-tauri/Cargo.toml`
Expected: 양쪽 모두 PASS

- [ ] **Step 2: 실행 중인 설치본을 끈다**

```bash
powershell -NoProfile -Command "Stop-Process -Name noteforjun -Force -ErrorAction SilentlyContinue"
```

`lib.rs`의 `tauri_plugin_single_instance`가 앱 식별자(`com.noteforjun.app`)로 중복 실행을 막는다. 설치본이 켜져 있으면 개발 빌드는 뜨자마자 종료되고 설치본에 빈 메모만 하나 추가된다.

개발 빌드는 설치본과 **같은 메모 폴더**(`%APPDATA%\NoteforJun\notes`)를 쓴다. 실험 중 실제 메모가 바뀔 수 있다. 사용자가 원하면 먼저 폴더를 통으로 복사해 둔다.

- [ ] **Step 3: 개발 빌드를 띄운다**

Run: `npm run tauri dev`
Expected: 첫 빌드에 1~3분. 메모 창이 뜬다.

- [ ] **Step 4: 항목별로 확인한다**

| # | 확인할 것 | 통과 기준 |
|---|---|---|
| 1 | 다른 프로그램(브라우저 등)을 클릭한다 | 메모가 여전히 앞에 보인다 |
| 2 | 본문 글자 크기 | 이전보다 한 단계 크다 |
| 3 | 한글을 빠르게 친다 | 좌상단 조합창이 뜨지 않고, 글자가 제때 들어간다 |
| 4 | 상단바 가운데 선을 잡아 창을 옮긴다 | 한 번에 잡히고, 커서를 올리면 진해진다 |
| 5 | 앱을 껐다 켠다 | 내용 있는 메모가 최대 5개 뜨고, 빈 메모는 안 뜬다 |
| 6 | `?`에 커서를 올린다 / 제목칸에서 Shift+Tab을 여러 번 눌러 `?`에 닿는다 | 둘 다 안내가 뜬다 |
| 6 | 창을 최소 폭(220px)까지 좁히고 `?`를 연다 | 안내가 잘리지 않고 줄바꿈된다 |
| 7 | 본문에서 글자를 끌고 Tab을 네 번 누른다 | B → I → U → 형광펜 → 다시 B |
| 7 | 형광펜에 초점이 있을 때 Esc | 팝업이 닫히고 초점이 본문으로 돌아온다 |

- [ ] **Step 5: 결과를 보고한다**

통과하지 못한 항목이 있으면 **고치기 전에** 무엇이 어떻게 어긋났는지 먼저 보고한다. 특히 3번은 원인을 단정하지 않은 채 유발 요인만 제거한 항목이라, 증상이 남아 있으면 그 사실을 그대로 알린다.

통과했다면 앱을 끄고 설치본을 다시 켠다.

```bash
powershell -NoProfile -Command "Start-Process 'C:\Program Files\NoteforJun\noteforjun.exe'"
```

---

## 설계 문서와 달라진 점

**2.3 한글 입력**: 설계 문서는 "조합 중에는 건너뛰고, 조합이 끝난 뒤 한 번"이라고 적었다. 구현은 **조합 상태를 보지 않고 직렬화 자체를 저장 시점으로 미루는** 쪽을 택했다(Task 3). 의도는 같고 — 타이핑마다 문서 전체를 HTML로 만들지 않는다 — 결과는 더 낫다.

- `compositionend` 시점에 ProseMirror가 문서를 이미 반영했는지 추측할 필요가 없다.
- 설계 문서가 "반드시 지켜야 할 조건"으로 못박은 것(조합이 끝나면 확실히 저장돼야 한다)이 구조적으로 보장된다. 저장 직전에 읽으므로 잃을 경로가 없다.
- 코드가 줄어든다. 조합 상태 분기도, 별도 리스너도 없다.
