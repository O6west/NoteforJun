# NoteforJun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 윈도우 스티키 노트를 베이스로 제목·큰 글씨·체크박스·굵게/기울임/밑줄·형광펜만 더하고, 설계 문서 `docs/superpowers/specs/2026-09-11-noteforjun-design.md`의 완성 기준 20개를 전부 통과하는 데스크톱 메모 앱을 만든다.

**Architecture:** Tauri 2 앱. Rust는 파일 저장·창 관리·시스템 연동 네 가지만 맡고, 화면은 순수 HTML/CSS/JS로 그린다. 메모 하나가 창 하나이며 모든 메모 창은 같은 `note.html`을 쿼리 파라미터 `?id=`로 구분해서 연다. 목록 창은 `list.html` 하나뿐이다. 저장은 메모당 JSON 파일 하나이며 임시 파일에 쓴 뒤 이름을 바꾸는 방식으로 원자성을 확보한다. 글 편집은 Tiptap(ProseMirror)에 맡겨 한글 IME 처리를 직접 하지 않는다.

**Tech Stack:** Tauri 2 · Rust (serde, serde_json, uuid) · Vite 6 · Tiptap 2 · Vitest + jsdom · Pretendard

## Global Constraints

설계 문서의 확정값이다. 모든 태스크의 요구사항에 암묵적으로 포함된다.

- 앱 이름: `NoteforJun` / 번들 식별자: `com.noteforjun.app`
- 대상 플랫폼: 윈도우 11 (x86_64-pc-windows-msvc)
- 저장 위치: `%APPDATA%\NoteforJun\notes\<uuid>.json` — 번들 식별자 경로가 아니라 이 경로를 직접 구성한다
- 본문 배경 `#FBF8F2` 고정 / 본문 글자색 `#2E2E2C` / 형광펜 `#F7E27F` 단색
- 상단바 색은 정확히 6종이며 이 값 외에 추가하지 않는다:
  | key | 배경 | 글자색 |
  |---|---|---|
  | `yellow` | `#E0B84D` | `#3D2F10` |
  | `green` | `#7FA86B` | `#FFFFFF` |
  | `purple` | `#A98BC4` | `#FFFFFF` |
  | `blue` | `#6FA3BF` | `#FFFFFF` |
  | `orange` | `#D98C6A` | `#FFFFFF` |
  | `gray` | `#9A9A94` | `#FFFFFF` |
- 새 메모 기본색은 항상 `yellow`
- 폰트는 Pretendard 하나. 본문 14px/400, 큰 글씨 19px/700, 상단바 제목 13px/600, 목록 카드 제목 13px/600, 목록 미리보기 12px/400. 본문 줄간격 1.72
- 제목 최대 20자 (입력 자체를 막는다)
- 메모 창 기본 300×300 / 최소 220×160
- 목록 창 기본 360×520 / **최소 폭 360px** (20자 제목이 잘리지 않는다는 보증)
- 자동 저장 디바운스 500ms
- 전역 단축키 `Ctrl+Alt+N`
- 헤딩은 1단계만 (`##`, `###` 동작 안 함)
- 서식은 큰 글씨·체크박스·굵게·기울임·밑줄·형광펜 여섯 가지뿐. 취소선은 체크박스가 자동 적용하므로 별도 제공하지 않는다
- 설정 화면을 만들지 않는다. 사용자가 조절 가능한 것은 색 6종과 창 크기·위치뿐이다
- Tiptap은 **v2 계열**로 고정한다 (`^2.11.0`)

## 테스트 전략

자동화할 수 있는 것과 없는 것을 미리 갈라둔다.

| 영역 | 방법 |
|---|---|
| 저장 계층, HTML 텍스트 추출, 창 위치 계산 | `cargo test` — 순수 함수로 분리해 전부 자동화 |
| 제목 자르기, 미리보기, 검색 필터, 디바운스 | `vitest` — 순수 함수 |
| 입력 규칙(`# `, `- `), 서식 명령, 체크박스 Enter | `vitest` + jsdom + ProseMirror 트랜잭션 직접 주입 |
| **한글 IME 조합 중 동작** | **수동 확인.** jsdom은 `compositionstart`/`compositionupdate`를 실제 IME처럼 재현하지 못한다. 억지로 흉내 내면 통과해도 의미가 없으므로 Task 10의 수동 체크리스트로 검증한다 |
| 창 복원, 자동 실행, 전역 단축키, 메모리 사용량 | 수동 확인 (Task 10) |

---

## File Structure

```
노트앱-개발/
├─ package.json                      npm 스크립트와 의존성
├─ vite.config.js                    2페이지(note/list) 빌드 설정
├─ vitest.config.js                  jsdom 테스트 설정
├─ test/setup.js                     ProseMirror용 jsdom 보정
├─ src/
│  ├─ note.html                      메모 창 뼈대
│  ├─ list.html                      목록 창 뼈대
│  ├─ note.js                        메모 창 진입점 (조립만)
│  ├─ list.js                        목록 창 진입점 (조립만)
│  ├─ styles/
│  │  ├─ tokens.css                  확정값 전부 (색/폰트/크기)
│  │  ├─ note.css                    메모 창 레이아웃
│  │  └─ list.css                    목록 창 레이아웃
│  ├─ lib/
│  │  ├─ api.js                      Rust 명령 래퍼 (유일한 통로)
│  │  ├─ colors.js                   6색 정의
│  │  ├─ title.js                    제목 20자 제한
│  │  ├─ preview.js                  본문 텍스트 → 첫 줄 / 2줄 미리보기
│  │  ├─ search.js                   목록 검색 필터
│  │  └─ debounce.js                 자동 저장용
│  └─ editor/
│     ├─ rules.js                    입력 규칙 정규식 (테스트 대상)
│     ├─ extensions.js               Tiptap 확장 조립
│     ├─ editor.js                   에디터 생성
│     └─ bubble.js                   드래그 팝업 B I U ✏
└─ src-tauri/
   ├─ Cargo.toml
   ├─ build.rs
   ├─ tauri.conf.json
   ├─ icons/                         PowerShell로 생성
   └─ src/
      ├─ main.rs                     진입점
      ├─ lib.rs                      앱 조립, 플러그인 등록
      ├─ note.rs                     Note / NoteSummary 구조체
      ├─ html.rs                     HTML → 순수 텍스트
      ├─ storage.rs                  파일 읽기/쓰기/삭제/목록
      ├─ windows.rs                  창 생성·숨김·복원, 위치 계산
      └─ commands.rs                 Tauri 명령 (얇은 위임)
```

**경계 원칙:** `storage.rs`는 창을 모르고, `windows.rs`는 파일 형식을 모르고, `commands.rs`는 둘을 이어붙이기만 한다. `storage.rs`와 `html.rs`, `windows.rs`의 위치 계산은 Tauri에 의존하지 않는 순수 함수라 단위 테스트가 가능하다.

---

### Task 1: 프로젝트 뼈대와 첫 실행

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`(수정)
- Create: `src/note.html`, `src/list.html`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src-tauri/icons/` (스크립트로 생성)

**Interfaces:**
- Consumes: 없음
- Produces: `npm run tauri dev`로 실행되는 빈 Tauri 앱. 이후 모든 태스크가 이 위에서 돌아간다.

- [ ] **Step 1: `.gitignore`에 빌드 산출물 추가**

기존 `.gitignore`에 아래를 덧붙인다:

```
node_modules/
dist/
src-tauri/target/
src-tauri/gen/
```

- [ ] **Step 2: `package.json` 작성**

```json
{
  "name": "noteforjun",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tiptap/core": "^2.11.0",
    "@tiptap/extension-bold": "^2.11.0",
    "@tiptap/extension-document": "^2.11.0",
    "@tiptap/extension-heading": "^2.11.0",
    "@tiptap/extension-highlight": "^2.11.0",
    "@tiptap/extension-history": "^2.11.0",
    "@tiptap/extension-italic": "^2.11.0",
    "@tiptap/extension-paragraph": "^2.11.0",
    "@tiptap/extension-placeholder": "^2.11.0",
    "@tiptap/extension-task-item": "^2.11.0",
    "@tiptap/extension-task-list": "^2.11.0",
    "@tiptap/extension-text": "^2.11.0",
    "@tiptap/extension-underline": "^2.11.0",
    "pretendard": "^1.3.9"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "jsdom": "^25.0.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: `vite.config.js` 작성**

```js
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src',
  publicDir: false,
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        note: resolve(import.meta.dirname, 'src/note.html'),
        list: resolve(import.meta.dirname, 'src/list.html'),
      },
    },
  },
})
```

- [ ] **Step 4: 최소 HTML 두 개 작성**

`src/note.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>NoteforJun</title>
  </head>
  <body>
    <div id="app">note</div>
  </body>
</html>
```

`src/list.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>모든 메모</title>
  </head>
  <body>
    <div id="app">list</div>
  </body>
</html>
```

- [ ] **Step 5: 의존성 설치**

Run: `npm install`
Expected: `node_modules/` 생성, 오류 없음. `@tiptap/core`가 2.x로 설치되었는지 `npm ls @tiptap/core`로 확인한다.

- [ ] **Step 6: Rust 쪽 파일 작성**

`src-tauri/Cargo.toml`:

```toml
[package]
name = "noteforjun"
version = "0.1.0"
edition = "2021"

[lib]
name = "noteforjun_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
```

`src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    noteforjun_lib::run()
}
```

`src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running NoteforJun");
}
```

`src-tauri/capabilities/default.json` — **이 파일을 빠뜨리면 화면(JS) 쪽이 시스템 기능을 하나도 못 쓴다.** 오류 메시지 없이 그냥 아무 일도 일어나지 않기 때문에 원인 찾기가 매우 어렵다. 상단바 끌기, 창 숨기기, 창 위치 읽기가 전부 여기에 달려 있다.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "NoteforJun의 모든 창(메모 창 note-*, 목록 창 list)에 필요한 권한",
  "windows": ["*"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-start-resize-dragging",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-set-focus",
    "core:window:allow-outer-position",
    "core:window:allow-inner-size",
    "core:window:allow-scale-factor",
    "core:event:default"
  ]
}
```

`windows: ["*"]`인 이유는 메모 창 이름이 `note-<uuid>`라 미리 적어둘 수 없기 때문이다. 1인용 로컬 앱이고 모든 창이 우리 것이므로 전부 허용해도 무방하다.

`src-tauri/tauri.conf.json` — 이 단계에서는 눈으로 확인할 창이 하나 필요하므로 `note.html`을 띄운다. Task 3에서 프로그램이 직접 창을 만들도록 바꾼다.

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "NoteforJun",
  "version": "0.1.0",
  "identifier": "com.noteforjun.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "bootstrap",
        "url": "note.html",
        "title": "NoteforJun",
        "width": 300,
        "height": 300
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 7: 앱 아이콘 생성**

외부 이미지 파일에 의존하지 않도록 확정된 색으로 직접 그린다. PowerShell에서 실행한다:

```powershell
Add-Type -AssemblyName System.Drawing
$size = 1024
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

$pad = 96
$w = $size - ($pad * 2)
$paper = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FBF8F2'))
$bar   = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#E0B84D'))
$ink   = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#D9D5CC'))

$g.FillRectangle($paper, $pad, $pad, $w, $w)
$g.FillRectangle($bar, $pad, $pad, $w, 168)

$lineX = $pad + 88
$lineW = $w - 176
foreach ($i in 0..2) {
  $y = $pad + 300 + ($i * 128)
  $len = if ($i -eq 2) { [int]($lineW * 0.55) } else { $lineW }
  $g.FillRectangle($ink, $lineX, $y, $len, 44)
}

$g.Dispose()
New-Item -ItemType Directory -Force -Path 'src-tauri' | Out-Null
$bmp.Save((Join-Path (Get-Location) 'src-tauri\app-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
'icon written'
```

Expected: `icon written` 출력, `src-tauri/app-icon.png` 생성.

- [ ] **Step 8: 아이콘 세트로 변환**

Run: `npx tauri icon src-tauri/app-icon.png`
Expected: `src-tauri/icons/` 아래에 `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`, `icon.icns` 등이 생성된다.

- [ ] **Step 9: 실행 확인**

Run: `npm run tauri dev`
Expected: 첫 빌드는 몇 분 걸린다. 300×300 창이 뜨고 안에 `note`라는 글자가 보이면 성공이다. 확인 후 `Ctrl+C`로 종료한다.

실패 시 점검 순서: `link.exe not found` → Visual Studio Build Tools 문제 / 빈 흰 창 → WebView2 문제 / `devUrl` 연결 실패 → Vite가 1420 포트에 떴는지 확인.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "chore: Tauri 2 + Vite 프로젝트 뼈대 구성"
```

---

### Task 2: 저장 계층 — 구조체와 원자적 파일 저장

**Files:**
- Create: `src-tauri/src/note.rs`
- Create: `src-tauri/src/html.rs`
- Create: `src-tauri/src/storage.rs`
- Modify: `src-tauri/src/lib.rs` (모듈 선언 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `note::Note { id: String, title: String, content: String, color: String, window: WindowState, created_at: String, updated_at: String }` (JSON은 camelCase)
  - `note::WindowState { x: i32, y: i32, width: u32, height: u32, visible: bool }`
  - `note::NoteSummary { id, title, text, color, updated_at }`
  - `html::strip_html(&str) -> String`
  - `storage::notes_dir(&Path) -> PathBuf`
  - `storage::save(&Path, &Note) -> io::Result<()>`
  - `storage::load(&Path, &str) -> io::Result<Note>`
  - `storage::list(&Path) -> io::Result<Vec<NoteSummary>>`
  - `storage::delete(&Path, &str) -> io::Result<()>`

- [ ] **Step 1: 모듈 선언을 `lib.rs`에 추가**

`src-tauri/src/lib.rs` 맨 위에 추가한다:

```rust
pub mod html;
pub mod note;
pub mod storage;
```

- [ ] **Step 2: `html.rs`의 실패하는 테스트 작성**

`src-tauri/src/html.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_tags_and_keeps_text() {
        assert_eq!(strip_html("<p>안녕</p>"), "안녕");
    }

    #[test]
    fn block_tags_become_newlines() {
        assert_eq!(strip_html("<p>첫줄</p><p>둘째줄</p>"), "첫줄\n둘째줄");
    }

    #[test]
    fn br_becomes_newline() {
        assert_eq!(strip_html("<p>가<br>나</p>"), "가\n나");
    }

    #[test]
    fn inline_tags_do_not_break_lines() {
        assert_eq!(strip_html("<p>아주 <strong>중요</strong>함</p>"), "아주 중요함");
    }

    #[test]
    fn decodes_entities() {
        assert_eq!(strip_html("<p>a &amp; b &lt;c&gt; &nbsp;d &quot;e&quot; &#39;f&#39;</p>"), "a & b <c>  d \"e\" 'f'");
    }

    #[test]
    fn empty_html_is_empty_string() {
        assert_eq!(strip_html(""), "");
        assert_eq!(strip_html("<p></p>"), "");
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd src-tauri && cargo test html::`
Expected: FAIL — `cannot find function strip_html in this scope`

- [ ] **Step 4: `strip_html` 구현**

`src-tauri/src/html.rs`의 테스트 모듈 **위쪽**에 넣는다:

```rust
/// HTML 문자열에서 태그를 제거하고 순수 텍스트만 남긴다.
/// 블록 태그는 줄바꿈으로 바꾼다. 목록 창의 미리보기와 검색에 쓰인다.
pub fn strip_html(html: &str) -> String {
    const BLOCK_TAGS: [&str; 6] = ["p", "div", "li", "h1", "br", "ul"];

    let mut out = String::new();
    let mut tag = String::new();
    let mut in_tag = false;

    for ch in html.chars() {
        match ch {
            '<' => {
                in_tag = true;
                tag.clear();
            }
            '>' if in_tag => {
                in_tag = false;
                let name = tag
                    .trim_start_matches('/')
                    .split(|c: char| c.is_whitespace() || c == '/')
                    .next()
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if BLOCK_TAGS.contains(&name.as_str()) && !out.is_empty() && !out.ends_with('\n') {
                    out.push('\n');
                }
            }
            _ if in_tag => tag.push(ch),
            _ => out.push(ch),
        }
    }

    decode_entities(out.trim())
}

fn decode_entities(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}
```

`&amp;`를 마지막에 처리하는 것이 중요하다. 먼저 바꾸면 `&amp;lt;`가 `<`로 잘못 풀린다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src-tauri && cargo test html::`
Expected: PASS — 6개 테스트 전부 통과

- [ ] **Step 6: `note.rs` 작성**

테스트가 필요한 로직이 `NoteSummary::from` 하나뿐이므로 구조체와 함께 쓰고 바로 테스트한다.

`src-tauri/src/note.rs`:

```rust
use serde::{Deserialize, Serialize};

use crate::html::strip_html;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub visible: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self { x: 48, y: 48, width: 300, height: 300, visible: true }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub color: String,
    pub window: WindowState,
    pub created_at: String,
    pub updated_at: String,
}

/// 목록 창에 보낼 요약. `text`는 검색과 미리보기 양쪽에 쓰이므로 본문 전체의 순수 텍스트다.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub text: String,
    pub color: String,
    pub updated_at: String,
}

impl From<&Note> for NoteSummary {
    fn from(n: &Note) -> Self {
        Self {
            id: n.id.clone(),
            title: n.title.clone(),
            text: strip_html(&n.content),
            color: n.color.clone(),
            updated_at: n.updated_at.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn sample(id: &str, updated_at: &str) -> Note {
        Note {
            id: id.to_string(),
            title: "이번주 할일".to_string(),
            content: "<p>장보기</p><p>운동</p>".to_string(),
            color: "yellow".to_string(),
            window: WindowState::default(),
            created_at: "2026-09-11T10:00:00Z".to_string(),
            updated_at: updated_at.to_string(),
        }
    }

    #[test]
    fn summary_strips_html_from_content() {
        let s = NoteSummary::from(&sample("a", "2026-09-11T10:00:00Z"));
        assert_eq!(s.text, "장보기\n운동");
        assert_eq!(s.title, "이번주 할일");
        assert_eq!(s.color, "yellow");
    }

    #[test]
    fn window_default_matches_spec() {
        let w = WindowState::default();
        assert_eq!((w.width, w.height), (300, 300));
        assert!(w.visible);
    }
}
```

- [ ] **Step 7: `note.rs` 테스트 통과 확인**

Run: `cd src-tauri && cargo test note::`
Expected: PASS — 2개 통과

- [ ] **Step 8: 커밋**

```bash
git add src-tauri/src/html.rs src-tauri/src/note.rs src-tauri/src/lib.rs
git commit -m "feat: 메모 구조체와 HTML 텍스트 추출"
```

- [ ] **Step 9: `storage.rs`의 실패하는 테스트 작성**

`src-tauri/src/storage.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::note::{Note, WindowState};
    use std::env;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("nfj-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn note(id: &str, updated_at: &str) -> Note {
        Note {
            id: id.to_string(),
            title: "제목".to_string(),
            content: "<p>본문</p>".to_string(),
            color: "yellow".to_string(),
            window: WindowState::default(),
            created_at: "2026-09-11T10:00:00Z".to_string(),
            updated_at: updated_at.to_string(),
        }
    }

    #[test]
    fn save_then_load_roundtrip() {
        let dir = temp_dir("roundtrip");
        let n = note("aaa", "2026-09-11T10:00:00Z");
        save(&dir, &n).unwrap();
        assert_eq!(load(&dir, "aaa").unwrap(), n);
    }

    #[test]
    fn save_leaves_no_tmp_file() {
        let dir = temp_dir("notmp");
        save(&dir, &note("aaa", "2026-09-11T10:00:00Z")).unwrap();
        let names: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["aaa.json".to_string()]);
    }

    #[test]
    fn save_overwrites_existing() {
        let dir = temp_dir("overwrite");
        save(&dir, &note("aaa", "2026-09-11T10:00:00Z")).unwrap();
        let mut n2 = note("aaa", "2026-09-11T11:00:00Z");
        n2.title = "바뀐 제목".to_string();
        save(&dir, &n2).unwrap();
        assert_eq!(load(&dir, "aaa").unwrap().title, "바뀐 제목");
    }

    #[test]
    fn list_sorts_by_updated_at_desc() {
        let dir = temp_dir("sort");
        save(&dir, &note("old", "2026-09-01T10:00:00Z")).unwrap();
        save(&dir, &note("new", "2026-09-11T10:00:00Z")).unwrap();
        let ids: Vec<String> = list(&dir).unwrap().into_iter().map(|s| s.id).collect();
        assert_eq!(ids, vec!["new".to_string(), "old".to_string()]);
    }

    #[test]
    fn list_skips_corrupt_file_and_keeps_others() {
        let dir = temp_dir("corrupt");
        save(&dir, &note("good", "2026-09-11T10:00:00Z")).unwrap();
        fs::write(dir.join("broken.json"), "{ 이건 JSON이 아니다").unwrap();
        let ids: Vec<String> = list(&dir).unwrap().into_iter().map(|s| s.id).collect();
        assert_eq!(ids, vec!["good".to_string()]);
    }

    #[test]
    fn list_on_missing_dir_is_empty() {
        let dir = temp_dir("missing").join("nope");
        assert!(list(&dir).unwrap().is_empty());
    }

    #[test]
    fn delete_removes_file_and_is_idempotent() {
        let dir = temp_dir("delete");
        save(&dir, &note("aaa", "2026-09-11T10:00:00Z")).unwrap();
        delete(&dir, "aaa").unwrap();
        assert!(load(&dir, "aaa").is_err());
        delete(&dir, "aaa").unwrap();
    }

    #[test]
    fn notes_dir_appends_notes_segment() {
        assert_eq!(notes_dir(Path::new("C:/base")), PathBuf::from("C:/base/notes"));
    }

    #[test]
    fn concurrent_saves_never_corrupt_the_file() {
        let dir = temp_dir("concurrent");
        let mut handles = Vec::new();
        for i in 0..8 {
            let d = dir.clone();
            handles.push(std::thread::spawn(move || {
                for _ in 0..20 {
                    let mut n = note("aaa", "2026-09-11T10:00:00Z");
                    n.title = format!("제목 {i}");
                    save(&d, &n).unwrap();
                }
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        let loaded = load(&dir, "aaa").expect("동시 저장 후에도 파일은 읽을 수 있어야 한다");
        assert!(loaded.title.starts_with("제목 "));
    }

    #[test]
    fn rejects_ids_that_escape_the_notes_folder() {
        let dir = temp_dir("unsafe-id");
        assert!(load(&dir, "../secret").is_err());
        assert!(delete(&dir, "..\\secret").is_err());
        assert!(load(&dir, "sub/dir").is_err());

        let mut n = note("../escape", "2026-09-11T10:00:00Z");
        n.title = "탈출".to_string();
        assert!(save(&dir, &n).is_err());
    }

    #[test]
    fn accepts_uuid_shaped_ids() {
        let dir = temp_dir("safe-id");
        let n = note("3f2504e0-4f89-41d3-9a0c-0305e82c3301", "2026-09-11T10:00:00Z");
        save(&dir, &n).unwrap();
        assert_eq!(load(&dir, &n.id).unwrap().id, n.id);
    }
}
```

- [ ] **Step 10: 테스트 실패 확인**

`src-tauri/src/lib.rs`에 이미 `pub mod storage;`가 있으므로 파일만 있으면 컴파일을 시도한다.

Run: `cd src-tauri && cargo test storage::`
Expected: FAIL — `cannot find function save in this scope` 등

- [ ] **Step 11: `storage.rs` 구현**

테스트 모듈 **위쪽**에 넣는다:

```rust
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::note::{Note, NoteSummary};

/// 메모 id는 그대로 파일 이름이 된다. 지금은 앱이 만든 UUID뿐이지만
/// 다음 태스크부터는 화면 쪽에서 넘어오므로, 폴더를 벗어날 수 있는 값을 막는다.
fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn reject_unsafe_id(id: &str) -> io::Result<()> {
    if is_safe_id(id) {
        Ok(())
    } else {
        Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("잘못된 메모 id: {id}"),
        ))
    }
}

/// 앱 데이터 폴더 아래의 메모 폴더 경로.
pub fn notes_dir(base: &Path) -> PathBuf {
    base.join("notes")
}

/// 임시 파일에 먼저 쓰고 이름을 바꾼다. 쓰기 도중 전원이 끊겨도
/// 반쯤 쓰인 파일이 남지 않는다.
pub fn save(dir: &Path, note: &Note) -> io::Result<()> {
    reject_unsafe_id(&note.id)?;
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(note).map_err(io::Error::other)?;
    // 저장이 겹쳐도 서로 다른 임시 파일을 쓰도록 매번 새 이름을 만든다.
    // 같은 이름을 쓰면 두 저장의 바이트가 섞인 채 본 파일이 될 수 있다.
    let tmp = dir.join(format!("{}.{}.json.tmp", note.id, Uuid::new_v4()));
    let dest = dir.join(format!("{}.json", note.id));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &dest)
}

pub fn load(dir: &Path, id: &str) -> io::Result<Note> {
    reject_unsafe_id(id)?;
    let raw = fs::read_to_string(dir.join(format!("{id}.json")))?;
    serde_json::from_str(&raw).map_err(io::Error::other)
}

pub fn delete(dir: &Path, id: &str) -> io::Result<()> {
    reject_unsafe_id(id)?;
    let path = dir.join(format!("{id}.json"));
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

/// 최근 수정순으로 정렬한 요약 목록.
/// 읽거나 파싱할 수 없는 파일은 건너뛴다 — 메모 하나가 깨져도 나머지는 열려야 한다.
/// 폴더를 훑는 도중의 오류도 같은 이유로 건너뛴다.
pub fn list(dir: &Path) -> io::Result<Vec<NoteSummary>> {
    let mut out = Vec::new();
    if !dir.exists() {
        return Ok(out);
    }
    for entry in fs::read_dir(dir)? {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else { continue };
        let Ok(note) = serde_json::from_str::<Note>(&raw) else { continue };
        out.push(NoteSummary::from(&note));
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}
```

`.json.tmp`는 확장자가 `tmp`라 `list`가 자동으로 걸러낸다.

**임시 파일 이름을 매번 다르게 하는 이유**: 메모 창은 글이 바뀔 때와 창을 옮길 때 양쪽에서 같은 메모를 저장한다. 임시 파일 이름이 고정이면 두 저장이 같은 파일에 겹쳐 쓰이고, 섞인 내용이 그대로 본 파일이 될 수 있다. 이름이 다르면 늦게 도착한 저장이 이기고 끝나며, 둘 다 메모 전체를 담고 있으므로 어느 쪽이 이겨도 내용은 온전하다.

**`list`의 디렉터리 순회 오류를 건너뛰는 이유**: 파일 하나가 훑는 도중 사라지거나 일시적 입출력 오류가 나도 이미 모은 목록을 통째로 버리면 안 된다. 이 경로는 단위 테스트로 재현할 방법이 마땅치 않아 테스트 없이 코드로만 보장한다.

- [ ] **Step 12: 테스트 통과 확인**

Run: `cd src-tauri && cargo test`
Expected: PASS — storage 11개 + html 6개 + note 2개, 총 19개 통과

- [ ] **Step 13: 커밋**

```bash
git add src-tauri/src/storage.rs
git commit -m "feat: 메모 파일 저장 계층 (원자적 쓰기, 손상 파일 격리)"
```

---

### Task 3: 창 관리와 Tauri 명령

**Files:**
- Create: `src-tauri/src/windows.rs`
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json` (부트스트랩 창 제거)

**Interfaces:**
- Consumes: `storage::*`, `note::{Note, NoteSummary, WindowState}`
- Produces:
  - `windows::next_position(last: Option<(i32, i32)>, screen: (i32, i32), size: (u32, u32)) -> (i32, i32)`
  - `windows::note_label(id: &str) -> String` → `"note-<id>"`
  - `commands::AppPaths { notes: PathBuf }` (Tauri 상태)
  - Tauri 명령 8개: `list_notes`, `load_note`, `save_note`, `create_note`, `delete_note`, `open_note_window`, `hide_note_window`, `open_list_window`

- [ ] **Step 1: `lib.rs`에 모듈 선언 추가**

```rust
pub mod commands;
pub mod html;
pub mod note;
pub mod storage;
pub mod windows;
```

- [ ] **Step 2: 위치 계산의 실패하는 테스트 작성**

`src-tauri/src/windows.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: (i32, i32) = (1920, 1080);
    const SIZE: (u32, u32) = (300, 300);

    #[test]
    fn first_window_is_centered() {
        assert_eq!(next_position(None, SCREEN, SIZE), (810, 390));
    }

    #[test]
    fn next_window_cascades_down_right() {
        assert_eq!(next_position(Some((100, 100)), SCREEN, SIZE), (124, 124));
    }

    #[test]
    fn wraps_to_top_left_when_off_right_edge() {
        assert_eq!(next_position(Some((1900, 100)), SCREEN, SIZE), (48, 48));
    }

    #[test]
    fn wraps_to_top_left_when_off_bottom_edge() {
        assert_eq!(next_position(Some((100, 1000)), SCREEN, SIZE), (48, 48));
    }

    #[test]
    fn label_is_prefixed() {
        assert_eq!(note_label("abc-123"), "note-abc-123");
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd src-tauri && cargo test windows::`
Expected: FAIL — `cannot find function next_position in this scope`

- [ ] **Step 4: 순수 함수 구현**

`src-tauri/src/windows.rs`의 테스트 모듈 위쪽:

```rust
use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::note::Note;
use crate::storage;

const CASCADE_STEP: i32 = 24;
const CASCADE_ORIGIN: i32 = 48;

/// 새 메모 창이 뜰 위치. 마지막 창에서 오른쪽 아래로 비껴 놓되,
/// 화면 밖으로 나갈 위치가 되면 좌상단으로 되돌린다.
pub fn next_position(last: Option<(i32, i32)>, screen: (i32, i32), size: (u32, u32)) -> (i32, i32) {
    let (w, h) = (size.0 as i32, size.1 as i32);
    match last {
        None => ((screen.0 - w) / 2, (screen.1 - h) / 2),
        Some((x, y)) => {
            let (nx, ny) = (x + CASCADE_STEP, y + CASCADE_STEP);
            if nx + w > screen.0 || ny + h > screen.1 {
                (CASCADE_ORIGIN, CASCADE_ORIGIN)
            } else {
                (nx, ny)
            }
        }
    }
}

pub fn note_label(id: &str) -> String {
    format!("note-{id}")
}

pub const LIST_LABEL: &str = "list";

/// 주 모니터 크기를 논리 픽셀로 돌려준다.
/// 창을 만들 때 쓰는 좌표가 논리 픽셀이므로 여기서 단위를 맞춘다.
/// 화면 배율이 100%가 아니면 물리 픽셀과 값이 달라진다.
pub fn primary_screen_logical(app: &AppHandle) -> (i32, i32) {
    app.primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let s = m.size().to_logical::<f64>(m.scale_factor());
            (s.width.round() as i32, s.height.round() as i32)
        })
        .unwrap_or((1920, 1080))
}

/// 지금 떠 있는 창들 중 가장 오른쪽 아래에 있는 창의 위치(논리 픽셀).
/// 새 메모를 그 창에서 조금 비껴 놓기 위해 쓴다.
pub fn last_window_position(app: &AppHandle) -> Option<(i32, i32)> {
    app.webview_windows()
        .values()
        .filter_map(|w| {
            let scale = w.scale_factor().ok()?;
            let p = w.outer_position().ok()?.to_logical::<f64>(scale);
            Some((p.x.round() as i32, p.y.round() as i32))
        })
        .max_by_key(|(x, y)| x + y)
}
```

**단위를 반드시 맞춰야 하는 이유**: `outer_position()`과 `monitor.size()`는 **물리 픽셀**을 주는데, `WebviewWindowBuilder::position()`은 **논리 픽셀**을 받는다. 화면 배율이 125%·150%·200%인 흔한 환경에서 이 둘을 섞으면 새 메모 창이 엉뚱한 자리에 뜨거나 화면 밖으로 나간다. 메모 창은 제목 표시줄이 없어서 화면 밖으로 나가면 끌어다 되돌릴 수 없다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src-tauri && cargo test windows::`
Expected: PASS — 5개 통과

- [ ] **Step 6: 창 여닫기 함수 추가**

`windows.rs`의 `LIST_LABEL` 아래에 이어 쓴다. 이 부분은 Tauri 런타임이 필요해 단위 테스트 대상이 아니다 — Task 10에서 수동 확인한다.

```rust
/// 메모 창을 연다. 이미 있으면 보이게 하고 앞으로 가져온다.
pub fn open_note(app: &AppHandle, note: &Note) -> tauri::Result<()> {
    let label = note_label(&note.id);
    if let Some(win) = app.get_webview_window(&label) {
        win.show()?;
        win.set_focus()?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("note.html?id={}", note.id).into());
    WebviewWindowBuilder::new(app, &label, url)
        .title("NoteforJun")
        .inner_size(note.window.width as f64, note.window.height as f64)
        .min_inner_size(220.0, 160.0)
        .position(note.window.x as f64, note.window.y as f64)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .build()?;
    Ok(())
}

pub fn hide_note(app: &AppHandle, id: &str) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window(&note_label(id)) {
        win.hide()?;
    }
    Ok(())
}

pub fn close_note(app: &AppHandle, id: &str) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window(&note_label(id)) {
        win.close()?;
    }
    Ok(())
}

/// 목록 창은 하나뿐이다.
pub fn open_list(app: &AppHandle) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window(LIST_LABEL) {
        win.show()?;
        win.set_focus()?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, LIST_LABEL, WebviewUrl::App("list.html".into()))
        .title("모든 메모")
        .inner_size(360.0, 520.0)
        .min_inner_size(360.0, 240.0)
        .decorations(false)
        .resizable(true)
        .build()?;
    Ok(())
}

/// 앱 시작 시 호출한다. 보이는 상태로 저장된 메모를 전부 되살리고,
/// 메모가 하나도 없으면 빈 메모 하나를 만들어 띄운다.
pub fn restore_all(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let summaries = storage::list(notes_dir).unwrap_or_default();
    if summaries.is_empty() {
        // 첫 메모는 화면 중앙에 띄운다. 기본 좌표를 그대로 쓰면
        // next_position의 "창이 없으면 중앙" 분기가 영영 안 불린다.
        let mut note = crate::commands::new_note(notes_dir);
        let screen = primary_screen_logical(app);
        let (x, y) = next_position(None, screen, (note.window.width, note.window.height));
        note.window.x = x;
        note.window.y = y;
        let _ = storage::save(notes_dir, &note);
        return open_note(app, &note);
    }
    for s in summaries {
        if let Ok(note) = storage::load(notes_dir, &s.id) {
            if note.window.visible {
                open_note(app, &note)?;
            }
        }
    }
    Ok(())
}
```

- [ ] **Step 7: `commands.rs` 작성**

```rust
use std::path::PathBuf;

use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::note::{Note, NoteSummary, WindowState};
use crate::{storage, windows};

/// 앱 데이터 경로. `%APPDATA%\NoteforJun\notes` 를 가리킨다.
pub struct AppPaths {
    pub notes: PathBuf,
}

fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 정렬과 표시에만 쓰이므로 UTC 초 단위면 충분하다.
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// 1970-01-01 기준 경과 일수를 (년, 월, 일)로 바꾼다. Howard Hinnant 알고리즘.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// 새 메모 한 건. 기본색은 항상 노랑이다.
pub fn new_note(_notes_dir: &PathBuf) -> Note {
    let ts = now_iso();
    Note {
        id: Uuid::new_v4().to_string(),
        title: String::new(),
        content: String::new(),
        color: "yellow".to_string(),
        window: WindowState::default(),
        created_at: ts.clone(),
        updated_at: ts,
    }
}

#[tauri::command]
pub fn list_notes(paths: State<AppPaths>) -> Result<Vec<NoteSummary>, String> {
    storage::list(&paths.notes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_note(id: String, paths: State<AppPaths>) -> Result<Note, String> {
    storage::load(&paths.notes, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_note(note: Note, paths: State<AppPaths>) -> Result<(), String> {
    let mut note = note;
    note.updated_at = now_iso();
    storage::save(&paths.notes, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(app: AppHandle, paths: State<AppPaths>) -> Result<String, String> {
    let mut note = new_note(&paths.notes);

    let last = windows::last_window_position(&app);
    let screen = windows::primary_screen_logical(&app);
    let (x, y) = windows::next_position(last, screen, (note.window.width, note.window.height));
    note.window.x = x;
    note.window.y = y;

    storage::save(&paths.notes, &note).map_err(|e| e.to_string())?;
    windows::open_note(&app, &note).map_err(|e| e.to_string())?;
    Ok(note.id)
}

#[tauri::command]
pub fn delete_note(id: String, app: AppHandle, paths: State<AppPaths>) -> Result<(), String> {
    windows::close_note(&app, &id).map_err(|e| e.to_string())?;
    storage::delete(&paths.notes, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_note_window(id: String, app: AppHandle, paths: State<AppPaths>) -> Result<(), String> {
    let mut note = storage::load(&paths.notes, &id).map_err(|e| e.to_string())?;
    note.window.visible = true;
    storage::save(&paths.notes, &note).map_err(|e| e.to_string())?;
    windows::open_note(&app, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_note_window(id: String, app: AppHandle, paths: State<AppPaths>) -> Result<(), String> {
    // 저장 실패를 삼키면 안 된다. visible=false가 기록되지 않으면
    // 사용자가 닫은 메모가 다음 실행 때 다시 열린 채로 뜬다.
    let mut note = storage::load(&paths.notes, &id).map_err(|e| e.to_string())?;
    note.window.visible = false;
    storage::save(&paths.notes, &note).map_err(|e| e.to_string())?;
    windows::hide_note(&app, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_list_window(app: AppHandle) -> Result<(), String> {
    windows::open_list(&app).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_note_defaults_to_yellow_and_empty() {
        let n = new_note(&PathBuf::from("."));
        assert_eq!(n.color, "yellow");
        assert!(n.title.is_empty());
        assert!(n.content.is_empty());
        assert_eq!(n.created_at, n.updated_at);
    }

    #[test]
    fn civil_from_days_matches_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_000), (2022, 1, 8));
    }

    #[test]
    fn now_iso_has_expected_shape() {
        let s = now_iso();
        assert_eq!(s.len(), 20);
        assert!(s.ends_with('Z'));
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[10..11], "T");
    }
}
```

- [ ] **Step 8: 테스트 실패 → 통과 확인**

Run: `cd src-tauri && cargo test commands::`
Expected: 처음에는 컴파일 실패(모듈 미등록)일 수 있다. Step 1을 마쳤다면 PASS — 3개 통과

- [ ] **Step 9: `lib.rs`에서 앱을 조립**

`src-tauri/src/lib.rs` 전체를 아래로 바꾼다:

```rust
pub mod commands;
pub mod html;
pub mod note;
pub mod storage;
pub mod windows;

use tauri::Manager;

use crate::commands::AppPaths;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let base = app
                .path()
                .data_dir()
                .expect("데이터 폴더를 찾을 수 없습니다")
                .join("NoteforJun");
            let notes = storage::notes_dir(&base);
            std::fs::create_dir_all(&notes)?;

            // 순서가 중요하다. restore_all이 만드는 메모 창은 뜨자마자
            // load_note를 부르는데, 그때 AppPaths가 등록돼 있어야 한다.
            app.manage(AppPaths { notes: notes.clone() });
            windows::restore_all(app.handle(), &notes)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_notes,
            commands::load_note,
            commands::save_note,
            commands::create_note,
            commands::delete_note,
            commands::open_note_window,
            commands::hide_note_window,
            commands::open_list_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteforJun");
}
```

- [ ] **Step 10: 부트스트랩 창 제거**

`src-tauri/tauri.conf.json`의 `app.windows`를 빈 배열로 바꾼다. 이제 창은 코드가 만든다.

```json
    "windows": [],
```

- [ ] **Step 11: 실행 확인**

Run: `npm run tauri dev`
Expected: 메모가 하나도 없으므로 빈 메모 창 하나가 화면 중앙에 뜬다. 창 테두리가 없는 상태(`decorations: false`)이므로 흰 사각형으로 보이는 것이 정상이다. `%APPDATA%\NoteforJun\notes\`에 JSON 파일이 하나 생겼는지 확인한다.

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: 창 관리와 Tauri 명령 8종"
```

---

### Task 4: 디자인 토큰과 메모 창 껍데기

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/note.css`
- Create: `src/lib/colors.js`, `src/lib/colors.test.js`
- Create: `src/lib/resize.js` (크기 조절 영역 — 메모 창과 목록 창이 함께 쓴다)
- Create: `vitest.config.js`, `test/setup.js`
- Modify: `src/note.html`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `colors.js`: `COLORS` 배열 (`{ key, bar, fg }` × 6), `DEFAULT_COLOR = 'yellow'`
  - CSS 변수: `--nfj-paper`, `--nfj-ink`, `--nfj-highlight`, `--nfj-font`
  - `note.html` DOM: `#titlebar`, `#new-note`, `#title`, `#menu-btn`, `#close`, `#editor`

- [ ] **Step 1: Vitest 설정 작성**

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['src/**/*.test.js'],
  },
})
```

`test/setup.js` — ProseMirror는 jsdom에 없는 DOM 측정 API를 부른다. 없으면 에디터 생성 자체가 터지므로 미리 채워 둔다.

```js
// jsdom에는 아래 API가 없거나 비어 있어서 ProseMirror가 초기화에 실패한다.
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
  })
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  })
}
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}
```

- [ ] **Step 2: 색 정의의 실패하는 테스트 작성**

`src/lib/colors.test.js` — 이 테스트의 목적은 "색이 6개를 넘지 않는다"는 설계 원칙을 코드로 고정하는 것이다.

```js
import { describe, expect, it } from 'vitest'
import { COLORS, DEFAULT_COLOR, colorOf } from './colors.js'

describe('COLORS', () => {
  it('정확히 6가지다', () => {
    expect(COLORS).toHaveLength(6)
  })

  it('설계 문서의 값과 정확히 일치한다', () => {
    expect(COLORS).toEqual([
      { key: 'yellow', bar: '#E0B84D', fg: '#3D2F10' },
      { key: 'green', bar: '#7FA86B', fg: '#FFFFFF' },
      { key: 'purple', bar: '#A98BC4', fg: '#FFFFFF' },
      { key: 'blue', bar: '#6FA3BF', fg: '#FFFFFF' },
      { key: 'orange', bar: '#D98C6A', fg: '#FFFFFF' },
      { key: 'gray', bar: '#9A9A94', fg: '#FFFFFF' },
    ])
  })

  it('기본색은 노랑이다', () => {
    expect(DEFAULT_COLOR).toBe('yellow')
  })

  it('모르는 key는 기본색으로 되돌린다', () => {
    expect(colorOf('없는색').key).toBe('yellow')
    expect(colorOf('blue').bar).toBe('#6FA3BF')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- colors`
Expected: FAIL — `Failed to resolve import "./colors.js"`

- [ ] **Step 4: `colors.js` 구현**

```js
/**
 * 메모 상단바 색. 6가지가 전부이며 사용자가 색을 만들 수 없다.
 * 색을 늘리려면 colors.test.js도 같이 고쳐야 한다 — 의도적인 마찰이다.
 */
export const COLORS = [
  { key: 'yellow', bar: '#E0B84D', fg: '#3D2F10' },
  { key: 'green', bar: '#7FA86B', fg: '#FFFFFF' },
  { key: 'purple', bar: '#A98BC4', fg: '#FFFFFF' },
  { key: 'blue', bar: '#6FA3BF', fg: '#FFFFFF' },
  { key: 'orange', bar: '#D98C6A', fg: '#FFFFFF' },
  { key: 'gray', bar: '#9A9A94', fg: '#FFFFFF' },
]

export const DEFAULT_COLOR = 'yellow'

export function colorOf(key) {
  return COLORS.find((c) => c.key === key) ?? COLORS[0]
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- colors`
Expected: PASS — 4개 통과

- [ ] **Step 6: `tokens.css` 작성**

`src/styles/tokens.css`:

```css
:root {
  --nfj-paper: #fbf8f2;
  --nfj-ink: #2e2e2c;
  --nfj-highlight: #f7e27f;
  --nfj-font: 'Pretendard', 'Malgun Gothic', sans-serif;

  --nfj-body-size: 14px;
  --nfj-body-line: 1.6;
  --nfj-h1-size: 19px;
  --nfj-title-size: 14px;
  --nfj-preview-size: 12px;

  --nfj-bar-height: 34px;
  --nfj-radius: 6px;
}

/* 상단바 색 6종. colors.js의 COLORS와 값이 일치해야 한다. */
[data-color='yellow'] { --nfj-bar: #e0b84d; --nfj-bar-fg: #3d2f10; }
[data-color='green']  { --nfj-bar: #7fa86b; --nfj-bar-fg: #ffffff; }
[data-color='purple'] { --nfj-bar: #a98bc4; --nfj-bar-fg: #ffffff; }
[data-color='blue']   { --nfj-bar: #6fa3bf; --nfj-bar-fg: #ffffff; }
[data-color='orange'] { --nfj-bar: #d98c6a; --nfj-bar-fg: #ffffff; }
[data-color='gray']   { --nfj-bar: #9a9a94; --nfj-bar-fg: #ffffff; }

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: var(--nfj-font);
  color: var(--nfj-ink);
  background: transparent;
  overflow: hidden;
}
```

크기 조절 영역은 토큰 파일이 아니라 **자기 파일**에 둔다. 토큰 파일이 다른 파일의 선택자(`.bar-btn`, `#grabber`)를 건드리면, 한 요소의 스타일이 두 파일에 흩어져서 불러오는 순서가 승패를 가르게 된다. 그 순서는 코드 어디에도 적혀 있지 않다.

`src/styles/resize.css`:

```css
/*
 * 창 크기 조절 영역. 눈에는 보이지 않고 손에만 걸린다.
 * 창 테두리를 껐기 때문에 OS가 주던 리사이즈 테두리가 없어서 직접 두른다.
 * 가장자리 8px / 모서리 20px — 모서리를 넓게 잡는 이유는 사람이 주로 모서리를
 * 노리기 때문이고, 가장자리를 더 넓히면 본문 첫 글자를 클릭하려다 크기가 바뀐다.
 *
 * 층위는 100이다. 이보다 위에 있어야 하는 것(상단바 버튼, 창 이동 손잡이)은
 * 각자의 파일에서 101을 준다. 여기서 남의 선택자를 건드리지 않는다 —
 * 한 요소의 스타일이 두 파일에 흩어지면 불러오는 순서가 승패를 가르게 되고,
 * 그 순서는 코드 어디에도 적혀 있지 않다.
 */
.resize-zone { position: fixed; z-index: 100; }
.resize-n  { top: 0; left: 20px; right: 20px; height: 8px; cursor: ns-resize; }
.resize-s  { bottom: 0; left: 20px; right: 20px; height: 8px; cursor: ns-resize; }
.resize-w  { left: 0; top: 20px; bottom: 20px; width: 8px; cursor: ew-resize; }
.resize-e  { right: 0; top: 20px; bottom: 20px; width: 8px; cursor: ew-resize; }
.resize-nw { top: 0; left: 0; width: 20px; height: 20px; cursor: nwse-resize; }
.resize-ne { top: 0; right: 0; width: 20px; height: 20px; cursor: nesw-resize; }
.resize-sw { bottom: 0; left: 0; width: 20px; height: 20px; cursor: nesw-resize; }
.resize-se { bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; }
```

그리고 그 영역을 실제로 설치하는 `src/lib/resize.js`를 만든다. 목록 창도 같은 문제를 겪으므로 두 창이 함께 쓴다.

```js
// 모양이 동작을 따라다니게 한다. 이 함수를 부르는 창은 스타일시트를 따로 챙길 필요가 없다.
import '../styles/resize.css'
import { getCurrentWindow } from '@tauri-apps/api/window'

const ZONES = [
  { dir: 'NorthWest', cls: 'nw' },
  { dir: 'North', cls: 'n' },
  { dir: 'NorthEast', cls: 'ne' },
  { dir: 'West', cls: 'w' },
  { dir: 'East', cls: 'e' },
  { dir: 'SouthWest', cls: 'sw' },
  { dir: 'South', cls: 's' },
  { dir: 'SouthEast', cls: 'se' },
]

/**
 * 창 둘레에 보이지 않는 크기 조절 영역을 두른다.
 *
 * 창 테두리를 껐기 때문에(상단바를 직접 그리려고) OS가 주던 리사이즈 테두리도
 * 함께 사라졌다. 남은 판정 영역이 몇 px뿐이라 조준이 조금만 어긋나도 실패한다.
 *
 * 가장자리는 8px로 좁게, 모서리는 20px로 넓게 잡는다. 사람은 창 크기를 바꿀 때
 * 주로 모서리를 노리고, 가장자리를 더 넓히면 본문 첫 글자를 클릭하려다
 * 창 크기가 바뀌는 더 성가신 문제가 생긴다.
 */
export function installResizeZones(container = document.body) {
  // 두 번 부르면 판정 영역이 겹쳐 쌓이고 떼어낼 방법이 없다. 한 번만 설치한다.
  if (container.querySelector('.resize-zone')) return

  const win = getCurrentWindow()
  for (const { dir, cls } of ZONES) {
    const el = document.createElement('div')
    el.className = `resize-zone resize-${cls}`
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      win.startResizeDragging(dir).catch((err) => {
        console.error('크기 조절을 시작하지 못했습니다', err)
      })
    })
    container.appendChild(el)
  }
}
```

- [ ] **Step 7: `note.css` 작성**

`src/styles/note.css`:

```css
#shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--nfj-paper);
  border-radius: var(--nfj-radius);
  overflow: hidden;
}

#titlebar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: var(--nfj-bar-height);
  padding: 0 8px;
  background: var(--nfj-bar);
  color: var(--nfj-bar-fg);
  user-select: none;
}

/*
 * 창을 끌기 위한 손잡이.
 * 제목칸 위에 겹쳐 떠 있어 제목 폭을 전혀 뺏지 않는다. 제목을 20자까지
 * 꽉 채워도 잡을 곳이 사라지지 않는 것이 이 요소가 존재하는 이유다.
 * 보이는 선은 40px이지만 실제로 잡히는 영역은 56px로 넉넉히 둔다.
 */
#grabber {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  /* 크기 조절 영역(100)보다 위. 겹치는 자리에서는 끌기가 먼저 잡혀야 한다. */
  z-index: 101;
  width: 56px;
  height: 13px;
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
  width: 40px;
  height: 3px;
  border-radius: 2px;
  /* 상단바 글자색을 그대로 쓰므로 6색 어디서나 알아서 어울린다 */
  background: currentColor;
  opacity: 0.38;
}

.bar-btn {
  /* 위쪽 모서리 판정 영역(20x20)이 + 와 × 버튼을 덮지 않도록 그 위로 올린다 */
  position: relative;
  z-index: 101;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
}
.bar-btn:hover { opacity: 1; background: rgba(0, 0, 0, 0.1); }

#title {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: var(--nfj-title-size);
  font-weight: 600;
  /* input에서는 overflow: hidden 없이 text-overflow만 주면 말줄임이 나오지 않는다 */
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
}
#title::placeholder { color: inherit; opacity: 0.45; font-weight: 500; }

#editor {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 11px 12px 20px;
  font-size: var(--nfj-body-size);
  line-height: var(--nfj-body-line);
}
#editor .ProseMirror { outline: none; min-height: 100%; }
#editor p { margin: 0; }
#editor h1 { margin: 0 0 5px; font-size: var(--nfj-h1-size); font-weight: 700; }
#editor mark { background: var(--nfj-highlight); border-radius: 2px; padding: 0 2px; color: inherit; }

#editor ul[data-type='taskList'] { list-style: none; margin: 0; padding: 0; }
#editor ul[data-type='taskList'] li { display: flex; align-items: flex-start; gap: 7px; }
#editor ul[data-type='taskList'] li > label { flex: 0 0 auto; padding-top: 3px; }
#editor ul[data-type='taskList'] li > div { flex: 1 1 auto; min-width: 0; }
#editor ul[data-type='taskList'] li[data-checked='true'] > div {
  text-decoration: line-through;
  opacity: 0.5;
}

/*
 * 자동 저장 표시. 저장이 끝나면 잠깐 떴다가 스르르 사라진다.
 * 자리를 항상 차지하는 이유는, 나타날 때마다 제목칸 폭이 들썩이면
 * 글을 쓰는 동안 눈에 거슬리기 때문이다. 안 보일 뿐 자리는 늘 있다.
 */
#saved {
  flex: 0 0 auto;
  width: 14px;
  font-size: 12px;
  line-height: 1;
  text-align: center;
  color: inherit;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.55s ease;
}
#saved.show {
  opacity: 0.7;
  transition: opacity 0.12s ease;
}

/* 저장에 실패하면 사라지지 않는다. 사라지는 경고는 아무도 못 본다.
   색을 주지 않는 이유는 상단바 글자색이 6색마다 달라서다 — 어떤 색을 골라도
   여섯 중 어딘가에서는 안 보인다. ⚠ 기호 자체가 뜻을 전달한다. */
#saved.warn {
  opacity: 0.95;
  transition: none;
}

/* 빈 문서일 때만 안내 문구를 보여준다 */
#editor p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  opacity: 0.4;
}
```

- [ ] **Step 8: `note.html`을 실제 구조로 교체**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>NoteforJun</title>
  </head>
  <body>
    <div id="shell" data-color="yellow">
      <div id="titlebar" data-tauri-drag-region>
        <div id="grabber" data-tauri-drag-region title="끌어서 옮기기"><i></i></div>
        <button class="bar-btn" id="new-note" title="새 메모 (Ctrl+Alt+N)">+</button>
        <input id="title" type="text" maxlength="20" placeholder="제목" spellcheck="false" />
        <span id="saved" aria-hidden="true">✓</span>
        <button class="bar-btn" id="menu-btn" title="메뉴">⋯</button>
        <button class="bar-btn" id="close" title="닫기">×</button>
      </div>
      <div id="editor"></div>
    </div>
    <script type="module" src="./note.js"></script>
  </body>
</html>
```

- [ ] **Step 9: `note.js` 임시 진입점 작성**

Task 6에서 본격적으로 채운다. 지금은 스타일과 폰트가 실제로 적용되는지 눈으로 확인하는 것이 목적이다.

`src/note.js`:

```js
import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/note.css'

import { installResizeZones } from './lib/resize.js'

installResizeZones()

document.getElementById('editor').textContent = '여기에 메모…'
```

- [ ] **Step 10: 눈으로 확인**

Run: `npm run tauri dev`
Expected: 노란 상단바(높이 34px), 그 안에 `+`, "제목" 안내 문구, `⋯`, `×`. 본문은 아이보리 배경. 글꼴이 Pretendard로 보인다. 상단바 빈 곳을 끌면 창이 움직인다.

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "feat: 디자인 토큰과 메모 창 레이아웃"
```

---

### Task 5: 편집기 — Tiptap 확장과 입력 규칙

**Files:**
- Create: `src/editor/rules.js`, `src/editor/rules.test.js`
- Create: `src/editor/extensions.js`
- Create: `src/editor/editor.js`, `src/editor/editor.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `rules.js`: `TASK_INPUT_RULE` (정규식)
  - `extensions.js`: `buildExtensions() -> Extension[]`
  - `editor.js`: `createEditor({ element, content, onUpdate }) -> Editor`
  - `editor.test.js`가 내보내지는 않지만 재사용되는 개념: ProseMirror 트랜잭션으로 타이핑을 흉내내는 `typeText(editor, text)`

- [ ] **Step 1: 입력 규칙 정규식의 실패하는 테스트 작성**

`src/editor/rules.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { TASK_INPUT_RULE } from './rules.js'

describe('TASK_INPUT_RULE', () => {
  it('하이픈 + 공백에 반응한다', () => {
    expect('- ').toMatch(TASK_INPUT_RULE)
  })

  it('대괄호 쌍 + 공백에 반응한다', () => {
    expect('[] ').toMatch(TASK_INPUT_RULE)
  })

  it('공백 없이는 반응하지 않는다', () => {
    expect('-').not.toMatch(TASK_INPUT_RULE)
    expect('[]').not.toMatch(TASK_INPUT_RULE)
  })

  it('줄 중간의 하이픈에는 반응하지 않는다', () => {
    expect('가- ').not.toMatch(TASK_INPUT_RULE)
  })

  it('별표나 플러스에는 반응하지 않는다 (글머리표는 지원하지 않는다)', () => {
    expect('* ').not.toMatch(TASK_INPUT_RULE)
    expect('+ ').not.toMatch(TASK_INPUT_RULE)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- rules`
Expected: FAIL — `Failed to resolve import "./rules.js"`

- [ ] **Step 3: `rules.js` 구현**

```js
/**
 * 체크박스를 만드는 입력 규칙.
 * 설계상 `- `와 `[] ` 두 가지만 받는다. 글머리표(*, +)는 지원하지 않으므로
 * 하이픈이 체크박스와 충돌하지 않는다.
 */
export const TASK_INPUT_RULE = /^(?:-|\[\])\s$/
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- rules`
Expected: PASS — 5개 통과

- [ ] **Step 5: `extensions.js` 작성**

```js
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
```

`Heading.configure({ levels: [1] })`이 `##`을 막는 장치다. Tiptap은 설정된 단계만 정규식에 넣으므로 `## `는 아무 일도 일어나지 않는다.

- [ ] **Step 6: `editor.js` 작성**

```js
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
```

- [ ] **Step 7: 타이핑 흉내 헬퍼 작성**

입력 규칙은 실제 타이핑에만 반응하므로 테스트에서 한 글자씩 흘려보내야 한다. Task 7의 팝업 테스트도 같은 헬퍼를 쓰므로 처음부터 공용 파일에 둔다.

`test/helpers.js`:

```js
/**
 * 입력 규칙(`# `, `- `)은 handleTextInput을 거치는 실제 타이핑에만 반응한다.
 * insertContent로는 발동하지 않으므로 ProseMirror에 한 글자씩 직접 흘려보낸다.
 */
export function typeText(editor, text) {
  const { view } = editor
  for (const ch of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch))
    if (!handled) {
      view.dispatch(view.state.tr.insertText(ch, from, to))
    }
  }
}
```

- [ ] **Step 8: 에디터 동작의 실패하는 테스트 작성**

`src/editor/editor.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createEditor } from './editor.js'

let editor
let element

beforeEach(() => {
  element = document.createElement('div')
  document.body.appendChild(element)
  editor = createEditor({ element, content: '' })
})

afterEach(() => {
  editor.destroy()
  element.remove()
})

describe('큰 글씨', () => {
  it('"# "를 치면 h1이 되고 # 기호는 남지 않는다', () => {
    typeText(editor, '# 이번주 할일')
    const html = editor.getHTML()
    expect(html).toContain('<h1>이번주 할일</h1>')
    expect(html).not.toContain('#')
  })

  it('"## "는 아무 일도 하지 않는다 (헤딩은 1단계뿐)', () => {
    typeText(editor, '## 부제목')
    expect(editor.getHTML()).not.toContain('<h1>')
    expect(editor.getText()).toBe('## 부제목')
  })
})

describe('체크박스', () => {
  it('"- "를 치면 체크박스가 된다', () => {
    typeText(editor, '- 장보기')
    const html = editor.getHTML()
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('장보기')
  })

  it('"[] "를 쳐도 체크박스가 된다', () => {
    typeText(editor, '[] 운동')
    expect(editor.getHTML()).toContain('data-type="taskList"')
  })

  it('Enter를 누르면 다음 항목이 생긴다', () => {
    typeText(editor, '- 장보기')
    editor.commands.splitListItem('taskItem')
    typeText(editor, '운동')
    const items = editor.getHTML().match(/data-checked=/g) ?? []
    expect(items).toHaveLength(2)
  })

  it('빈 항목에서 Enter를 누르면 목록에서 빠져나온다', () => {
    typeText(editor, '- 장보기')
    editor.commands.splitListItem('taskItem')
    editor.commands.liftListItem('taskItem')
    expect(editor.getHTML()).toContain('<p></p>')
  })
})

describe('선택 서식', () => {
  beforeEach(() => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
  })

  it('굵게가 적용되고 해제된다', () => {
    editor.commands.toggleBold()
    expect(editor.getHTML()).toContain('<strong>')
    editor.commands.toggleBold()
    expect(editor.getHTML()).not.toContain('<strong>')
  })

  it('기울임이 적용된다', () => {
    editor.commands.toggleItalic()
    expect(editor.getHTML()).toContain('<em>')
  })

  it('밑줄이 적용된다', () => {
    editor.commands.toggleUnderline()
    expect(editor.getHTML()).toContain('<u>')
  })

  it('형광펜이 적용되고 isActive로 상태를 읽을 수 있다', () => {
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('<mark>')
    expect(editor.isActive('highlight')).toBe(true)
  })
})

describe('지원하지 않는 서식', () => {
  it('글머리표 확장이 없다', () => {
    expect(editor.schema.nodes.bulletList).toBeUndefined()
  })

  it('취소선 확장이 없다', () => {
    expect(editor.schema.marks.strike).toBeUndefined()
  })
})
```

- [ ] **Step 9: 한글 입력 테스트 작성**

한글은 이 앱에서 가장 많이 쓰일 문자인데 가장 깨지기 쉬운 지점이기도 하다. 자동으로 검증할 수 있는 것과 없는 것을 정직하게 갈라서, 가능한 것은 전부 테스트로 붙든다.

`src/editor/korean.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createEditor } from './editor.js'

let editor
let element

/**
 * 한글 입력을 흉내낸다.
 *
 * 정직하게 적어둔다. 아래 compositionstart/update/end 이벤트는 **실제로는
 * 아무것도 바꾸지 않는다.** jsdom에는 IME가 없고, 우리가 쓰는 확장 중에 조합
 * 이벤트를 듣는 것도 없다. 글자를 넣는 것은 마지막 줄의 insertText 하나뿐이며,
 * 이벤트 세 줄을 지워도 이 파일의 모든 테스트는 똑같이 통과한다.
 *
 * 그러므로 이 파일이 지키는 것은 조합 "도중"의 안전성이 아니라 이것들이다.
 *   - 한글이 들어간 뒤 글자와 문서 구조가 온전한가
 *   - 한글·영문·숫자를 섞었을 때 순서가 보존되는가
 *   - 큰 글씨와 체크박스 안에서, 그리고 일부 글자에만 서식이 제대로 걸리는가
 *   - 저장용 HTML로 나갔다 들어와도 한글이 엔티티로 바뀌지 않는가
 *
 * 조합 도중 글자가 깜빡이는지, 커서가 튀는지, 조합 중 자동 저장에 글자가
 * 날아가는지는 사람이 직접 쳐봐야만 알 수 있다. Task 10 수동 체크리스트에 있다.
 *
 * 이벤트를 남겨두는 이유는 하나뿐이다. 나중에 조합 이벤트를 듣는 확장이나
 * 직접 만든 처리가 들어오면, 그때부터는 이 테스트들이 진짜로 그 경로를 지나간다.
 */
function compose(ed, steps, final) {
  const { view } = ed
  view.dom.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
  for (const s of steps) {
    view.dom.dispatchEvent(new CompositionEvent('compositionupdate', { data: s }))
  }
  view.dom.dispatchEvent(new CompositionEvent('compositionend', { data: final }))
  const { from, to } = view.state.selection
  view.dispatch(view.state.tr.insertText(final, from, to))
}

/** '한글' 두 글자를 자모 단계까지 흉내내어 친다 */
function typeHangul(ed) {
  compose(ed, ['ㅎ', '하', '한'], '한')
  compose(ed, ['ㄱ', '그', '글'], '글')
}

beforeEach(() => {
  element = document.createElement('div')
  document.body.appendChild(element)
  editor = createEditor({ element, content: '' })
})

afterEach(() => {
  editor.destroy()
  element.remove()
})

describe('한글 조합 입력', () => {
  it('조합이 끝나면 완성된 글자가 남는다', () => {
    typeHangul(editor)
    expect(editor.getText()).toBe('한글')
  })

  it('조합을 반복해도 앞 글자가 지워지지 않는다', () => {
    for (const s of ['가', '나', '다', '라', '마']) {
      compose(editor, [s], s)
    }
    expect(editor.getText()).toBe('가나다라마')
  })

  it('한글과 영문·숫자를 섞어도 순서가 보존된다', () => {
    typeText(editor, 'A')
    compose(editor, ['ㄱ', '가'], '가')
    typeText(editor, '1')
    compose(editor, ['ㄴ', '나'], '나')
    expect(editor.getText()).toBe('A가1나')
  })
})

describe('한글과 서식', () => {
  it('큰 글씨 안에서 한글을 쳐도 큰 글씨가 유지된다', () => {
    typeText(editor, '# ')
    typeHangul(editor)
    expect(editor.getHTML()).toContain('<h1>한글</h1>')
  })

  it('체크박스 안에서 한글을 쳐도 체크박스가 유지된다', () => {
    typeText(editor, '- ')
    typeHangul(editor)
    const html = editor.getHTML()
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('한글')
  })

  it('체크박스에서 Enter를 눌러도 앞 항목의 한글이 남는다', () => {
    typeText(editor, '- ')
    typeHangul(editor)
    editor.commands.splitListItem('taskItem')
    compose(editor, ['ㄷ', '두'], '두')
    const text = editor.getText()
    expect(text).toContain('한글')
    expect(text).toContain('두')
  })

  it('한글에 굵게가 적용된다', () => {
    typeHangul(editor)
    editor.commands.selectAll()
    editor.commands.toggleBold()
    expect(editor.getHTML()).toContain('<strong>한글</strong>')
  })

  it('한글에 형광펜이 적용된다', () => {
    typeHangul(editor)
    editor.commands.selectAll()
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('<mark>한글</mark>')
  })

  it('한글 일부에만 서식을 걸 수 있다', () => {
    compose(editor, ['ㄱ', '가'], '가')
    compose(editor, ['ㄴ', '나'], '나')
    compose(editor, ['ㄷ', '다'], '다')
    // '나'만 선택 — 문서 시작이 1이므로 2~3이 두 번째 글자다
    editor.commands.setTextSelection({ from: 2, to: 3 })
    editor.commands.toggleHighlight()
    expect(editor.getHTML()).toContain('가<mark>나</mark>다')
  })
})

describe('저장되는 형태', () => {
  it('한글이 HTML 엔티티로 바뀌지 않고 그대로 저장된다', () => {
    typeHangul(editor)
    const html = editor.getHTML()
    expect(html).toContain('한글')
    expect(html).not.toContain('&#')
  })

  it('저장된 HTML을 다시 불러와도 한글이 그대로다', () => {
    typeHangul(editor)
    const saved = editor.getHTML()
    const el2 = document.createElement('div')
    document.body.appendChild(el2)
    const editor2 = createEditor({ element: el2, content: saved })
    expect(editor2.getText()).toBe('한글')
    editor2.destroy()
    el2.remove()
  })
})
```

- [ ] **Step 10: 테스트 실행**

Run: `npm test -- editor korean rules`
Expected: PASS — editor 13개 + korean 11개 + rules 5개 = 29개 통과

만약 `Range`나 `getClientRects` 관련 오류가 난다면 `test/setup.js`(Task 4 Step 1)가 제대로 로드되는지 확인한다. 특정 테스트가 jsdom 한계로 끝내 돌지 않으면 **테스트를 약화시키지 말고** 해당 항목을 Task 10 수동 체크리스트로 옮기고 그 사유를 주석으로 남긴다.

- [ ] **Step 11: 커밋**

```bash
git add src/editor test/helpers.js test/setup.js vitest.config.js
git commit -m "feat: Tiptap 편집기와 입력 규칙, 한글 입력 테스트"
```

---

### Task 6: 메모 창 조립 — 제목, 자동 저장, 색 메뉴

**Files:**
- Create: `src/lib/api.js`, `src/lib/debounce.js`, `src/lib/debounce.test.js`
- Create: `src/lib/serialize.js`, `src/lib/serialize.test.js` (저장을 한 줄로 세운다)
- Create: `src/lib/title.js`, `src/lib/title.test.js`
- Modify: `src/note.js`
- Modify: `src/styles/note.css` (색 메뉴 스타일 추가)

**Interfaces:**
- Consumes: `createEditor` (Task 5), `COLORS`/`colorOf`/`DEFAULT_COLOR` (Task 4), Tauri 명령 8종 (Task 3)
- Produces:
  - `api.js`: `listNotes()`, `loadNote(id)`, `saveNote(note)`, `createNote()`, `deleteNote(id)`, `openNoteWindow(id)`, `hideNoteWindow(id)`, `openListWindow()` — 전부 Promise
  - `debounce.js`: `debounce(fn, ms) -> { call, flush, cancel }`
  - `title.js`: `TITLE_MAX = 20`, `clampTitle(str) -> string`

- [ ] **Step 1: `debounce`의 실패하는 테스트 작성**

`src/lib/debounce.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('debounce', () => {
  it('지연 시간이 지나야 호출된다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('연달아 부르면 마지막 인자로 한 번만 호출된다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    vi.advanceTimersByTime(200)
    d.call('b')
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('flush는 기다리지 않고 즉시 호출한다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    d.flush()
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('대기 중인 호출이 없으면 flush는 아무 일도 하지 않는다', () => {
    const fn = vi.fn()
    debounce(fn, 500).flush()
    expect(fn).not.toHaveBeenCalled()
  })

  it('cancel하면 호출되지 않는다', () => {
    const fn = vi.fn()
    const d = debounce(fn, 500)
    d.call('a')
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush는 대기 중이던 함수의 반환값을 그대로 돌려준다', () => {
    const fn = vi.fn(() => 'saved')
    const d = debounce(fn, 500)
    d.call('a')
    expect(d.flush()).toBe('saved')
  })

  it('대기 중인 호출이 없으면 flush는 undefined를 돌려준다', () => {
    expect(debounce(vi.fn(), 500).flush()).toBeUndefined()
  })

  it('flush가 돌려준 약속을 기다릴 수 있다', async () => {
    const fn = vi.fn(() => Promise.resolve('저장됨'))
    const d = debounce(fn, 500)
    d.call()
    await expect(d.flush()).resolves.toBe('저장됨')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- debounce`
Expected: FAIL — `Failed to resolve import "./debounce.js"`

- [ ] **Step 3: `debounce.js` 구현**

```js
/**
 * 자동 저장용. `flush`가 있는 이유는 창을 닫거나 앱이 끝날 때
 * 대기 중인 저장을 버리지 않고 즉시 내보내야 하기 때문이다.
 */
export function debounce(fn, ms) {
  let timer = null
  let pending = null

  return {
    call(...args) {
      pending = args
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        const args2 = pending
        pending = null
        fn(...args2)
      }, ms)
    },
    flush() {
      // 반환이 중요하다. 창을 닫기 전에 저장이 끝나기를 기다리려면
      // 부르는 쪽이 기다릴 대상을 돌려받아야 한다.
      if (!timer) return undefined
      clearTimeout(timer)
      timer = null
      const args = pending
      pending = null
      return fn(...args)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- debounce`
Expected: PASS — 8개 통과

- [ ] **Step 4-1: 저장을 줄 세우는 `serialize` 작성**

글쓰기 저장과 창 위치 저장은 서로 다른 디바운스라 동시에 날아갈 수 있다. 먼저 출발한 저장이 늦게 도착하면 오래된 결과가 최신 결과를 덮는다 — 화면의 저장 표시도, 디스크의 내용도 그렇다. 번호표를 붙여 늦게 온 옵 결과를 무시하는 방법도 있지만, 애초에 겹치지 않게 줄을 세우는 편이 경합을 감추는 게 아니라 없애는 길이고, 따로 떼어내면 테스트도 가능하다.

먼저 실패하는 테스트를 쓴다. `src/lib/serialize.test.js`:

```js
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
```

Run: `npm test -- serialize`
Expected: FAIL — `Failed to resolve import "./serialize.js"`

그 다음 구현한다. `src/lib/serialize.js`:

```js
/**
 * 함수 호출을 한 줄로 세운다. 앞의 호출이 끝나야 다음이 출발한다.
 *
 * 저장이 겹치면 먼저 출발한 쪽이 늦게 도착할 수 있고, 그러면 오래된 결과가
 * 최신 결과를 덮어쓴다 — 화면의 저장 표시도, 디스크의 내용도 그렇다.
 * 순서를 지키면 그 경우가 아예 생기지 않는다.
 *
 * 앞의 호출이 실패해도 줄은 끊기지 않는다. 실패 하나 때문에 이후 저장이
 * 전부 멈추는 쪽이 훨씬 나쁘다.
 */
export function serialize(fn) {
  let chain = Promise.resolve()
  return (...args) => {
    const next = chain.then(
      () => fn(...args),
      () => fn(...args),
    )
    chain = next.catch(() => {})
    return next
  }
}
```

Run: `npm test -- serialize`
Expected: PASS — 4개 통과

- [ ] **Step 5: `title`의 실패하는 테스트 작성**

`src/lib/title.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { TITLE_MAX, clampTitle } from './title.js'

describe('clampTitle', () => {
  it('최대 길이는 20자다', () => {
    expect(TITLE_MAX).toBe(20)
  })

  it('20자 이하는 그대로 둔다', () => {
    expect(clampTitle('6월 일본여행 계획(오사카)')).toBe('6월 일본여행 계획(오사카)')
  })

  it('20자를 넘으면 잘라낸다', () => {
    const long = '가'.repeat(25)
    expect(clampTitle(long)).toHaveLength(20)
  })

  it('줄바꿈은 공백으로 바꾼다 (붙여넣기 대비)', () => {
    expect(clampTitle('첫줄\n둘째줄')).toBe('첫줄 둘째줄')
  })

  it('앞뒤 공백을 정리한다', () => {
    expect(clampTitle('  제목  ')).toBe('제목')
  })

  it('null이나 undefined는 빈 문자열이 된다', () => {
    expect(clampTitle(null)).toBe('')
    expect(clampTitle(undefined)).toBe('')
  })

  it('한글도 20자까지만 들어간다', () => {
    // 요즘 윈도우 IME는 '한'을 완성형 한 글자(U+D55C)로 준다. 여기까지는 문제없다.
    expect(clampTitle('한'.repeat(30))).toBe('한'.repeat(20))
  })

  it('조합용 낱자로 들어온 한글은 코드 단위로 센다 (현재 동작을 못박아 둔다)', () => {
    // 옛 방식의 조합용 낱자(ᄒ+ᅡ+ᆫ)는 눈에 한 글자로 보이지만 코드 단위로는 셋이라
    // 20자 제한에 더 적게 들어간다. 흔치 않지만 나중에 바뀌면 알아차리도록 적어 둔다.
    const jamo = '\u1112\u1161\u11AB'
    expect(jamo).toHaveLength(3)
    expect(clampTitle(jamo.repeat(10))).toHaveLength(20)
  })
})
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `npm test -- title`
Expected: FAIL — `Failed to resolve import "./title.js"`

- [ ] **Step 7: `title.js` 구현**

```js
export const TITLE_MAX = 20

/**
 * HTML의 maxlength는 붙여넣기와 IME 조합을 완전히 막지 못한다.
 * 저장 직전에 한 번 더 거른다.
 */
export function clampTitle(value) {
  if (!value) return ''
  return String(value).replace(/[\r\n]+/g, ' ').trim().slice(0, TITLE_MAX)
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- title`
Expected: PASS — 8개 통과

- [ ] **Step 9: `api.js` 작성**

Tauri와 이야기하는 유일한 통로다. 다른 파일은 `invoke`를 직접 부르지 않는다.

```js
import { invoke } from '@tauri-apps/api/core'

export const listNotes = () => invoke('list_notes')
export const loadNote = (id) => invoke('load_note', { id })
export const saveNote = (note) => invoke('save_note', { note })
export const createNote = () => invoke('create_note')
export const deleteNote = (id) => invoke('delete_note', { id })
export const openNoteWindow = (id) => invoke('open_note_window', { id })
export const hideNoteWindow = (id) => invoke('hide_note_window', { id })
export const openListWindow = () => invoke('open_list_window')
```

- [ ] **Step 10: 색 메뉴 스타일 추가**

`src/styles/note.css` 맨 아래에 덧붙인다:

```css
#menu {
  position: absolute;
  top: calc(var(--nfj-bar-height) + 4px);
  right: 8px;
  z-index: 10;
  padding: 8px;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
}
#menu[hidden] { display: none; }

#swatches { display: flex; gap: 6px; margin-bottom: 8px; }
.swatch {
  width: 22px;
  height: 22px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
}
.swatch[aria-pressed='true'] { border-color: #2e2e2c; }

.menu-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--nfj-ink);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover { background: rgba(0, 0, 0, 0.06); }
```

- [ ] **Step 11: `note.html`에 메뉴 DOM 추가**

`<div id="editor"></div>` **바로 다음**, `#shell` 안에 넣는다:

```html
      <div id="menu" hidden>
        <div id="swatches"></div>
        <button class="menu-item" id="open-list">모든 메모 보기</button>
      </div>
```

`#shell`에 `position: relative;`가 필요하므로 `note.css`의 `#shell` 규칙에 한 줄 추가한다:

```css
  position: relative;
```

- [ ] **Step 12: `note.js` 전체 구현**

```js
import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/note.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createEditor } from './editor/editor.js'
import {
  createNote,
  hideNoteWindow,
  loadNote,
  openListWindow,
  saveNote,
} from './lib/api.js'
import { COLORS, DEFAULT_COLOR } from './lib/colors.js'
import { debounce } from './lib/debounce.js'
import { installResizeZones } from './lib/resize.js'
import { serialize } from './lib/serialize.js'
import { clampTitle } from './lib/title.js'

const SAVE_DELAY = 500

installResizeZones()

const id = new URLSearchParams(location.search).get('id')
const shell = document.getElementById('shell')
const titleInput = document.getElementById('title')
const menu = document.getElementById('menu')
const swatches = document.getElementById('swatches')

let note = null
let editor = null
let remember = null

const savedMark = document.getElementById('saved')
let savedTimer = null
let lastSaveFailed = false
let closeHeld = false

/**
 * 저장이 끝났다는 표시를 잠깐 띄운다.
 * 아무 신호도 없이 조용히 저장하면 사용자는 저장됐는지 알 수 없고,
 * 그렇다고 늘 띄워두면 잔소리가 된다. 그래서 떴다가 스스로 사라진다.
 */
function flashSaved() {
  lastSaveFailed = false
  closeHeld = false
  savedMark.textContent = '✓'
  savedMark.title = ''
  savedMark.classList.remove('warn')
  savedMark.classList.add('show')
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => savedMark.classList.remove('show'), 900)
}

/** 저장 실패는 사라지지 않는 경고로 남긴다. 글이 날아가는 것이 이 앱 최악의 사고다. */
function showSaveError(err) {
  console.error('메모를 저장하지 못했습니다', err)
  lastSaveFailed = true
  clearTimeout(savedTimer)
  savedMark.textContent = '⚠'
  savedMark.title = '저장하지 못했습니다. 창을 닫지 말고 글을 복사해 두세요.'
  savedMark.classList.add('show', 'warn')
}

/**
 * 메모를 못 읽어도 창은 닫을 수 있어야 한다.
 *
 * 저장 실패와 달리 lastSaveFailed를 세우지 않는 것은 의도한 비대칭이다.
 * 불러오기가 실패하면 boot()이 멈춰 제목·본문 듣기가 붙지 않으므로
 * 사용자가 고친 것이 없고, 잃을 글도 없다. 붙잡을 이유가 없다.
 */
function showLoadError(err) {
  console.error('메모를 불러오지 못했습니다', err)
  const editorEl = document.getElementById('editor')
  editorEl.textContent = '이 메모를 불러오지 못했습니다. 파일이 손상되었을 수 있습니다.'
  editorEl.style.opacity = '0.55'
  savedMark.textContent = '⚠'
  savedMark.title = '메모를 불러오지 못했습니다.'
  savedMark.classList.add('show', 'warn')
}

/** 저장은 한 번에 하나씩만 나간다. 겹치면 오래된 결과가 최신 결과를 덮는다. */
const saveInOrder = serialize((n) => saveNote(n))

/** 저장하는 유일한 통로. 성공하면 표시를 띄우고, 실패하면 경고를 남긴다. */
function persist() {
  if (!note) return Promise.resolve()
  return saveInOrder(note).then(flashSaved, showSaveError)
}

const saver = debounce(() => persist(), SAVE_DELAY)

// 무슨 일이 있어도 창은 닫을 수 있어야 한다. 불러오기가 실패해도 마찬가지다.
document.getElementById('close').addEventListener('click', async () => {
  await saver.flush()
  if (remember) await remember.flush()

  // 저장이 실패했는데 창을 숨기면 경고를 볼 수 없고 글도 잃는다.
  // 한 번은 붙잡아 두고, 그래도 닫겠다면 그때는 닫아준다 —
  // 창 테두리가 없어 × 말고는 닫을 방법이 없으므로 영영 가둘 수는 없다.
  if (lastSaveFailed && !closeHeld) {
    closeHeld = true
    savedMark.title =
      '저장하지 못했습니다. 글을 복사해 두세요. ×를 한 번 더 누르면 저장하지 않고 닫습니다.'
    return
  }

  await hideNoteWindow(id)
})

function applyColor(key) {
  shell.dataset.color = key
  for (const btn of swatches.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.key === key))
  }
}

function buildSwatches() {
  for (const c of COLORS) {
    const btn = document.createElement('button')
    btn.className = 'swatch'
    btn.dataset.key = c.key
    btn.style.background = c.bar
    btn.title = c.key
    btn.addEventListener('click', () => {
      note.color = c.key
      applyColor(c.key)
      saver.call()
      menu.hidden = true
    })
    swatches.appendChild(btn)
  }
}

async function boot() {
  try {
    note = await loadNote(id)
  } catch (err) {
    showLoadError(err)
    return
  }
  buildSwatches()
  applyColor(note.color || DEFAULT_COLOR)

  titleInput.value = note.title
  titleInput.addEventListener('input', () => {
    note.title = clampTitle(titleInput.value)
    saver.call()
  })

  // 제목을 다 쓰면 본문으로 내려간다. 제목은 한 줄이라 Enter가 할 일이 따로 없고,
  // Tab은 그냥 두면 ⋯ 버튼으로 가버려서 정작 쓰려던 본문을 건너뛴다.
  titleInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && !(e.key === 'Tab' && !e.shiftKey)) return
    if (e.isComposing) return // 한글 조합을 끝내는 Enter는 넘기지 않는다
    e.preventDefault()
    editor?.commands.focus('end')
  })

  editor = createEditor({
    element: document.getElementById('editor'),
    content: note.content,
    onUpdate: (html) => {
      note.content = html
      saver.call()
    },
  })

  document.getElementById('new-note').addEventListener('click', () => createNote())
  document.getElementById('open-list').addEventListener('click', () => {
    menu.hidden = true
    openListWindow()
  })
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    menu.hidden = !menu.hidden
  })
  document.addEventListener('click', () => {
    menu.hidden = true
  })

  // 창 위치·크기는 이동이 끝난 시점에만 저장한다.
  const win = getCurrentWindow()
  remember = debounce(async () => {
    const pos = await win.outerPosition()
    const size = await win.innerSize()
    note.window = { x: pos.x, y: pos.y, width: size.width, height: size.height, visible: true }
    return persist()
  }, SAVE_DELAY)
  await win.onMoved(() => remember.call())
  await win.onResized(() => remember.call())

  titleInput.focus()
}

boot()
```

- [ ] **Step 13: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — colors 4 + rules 5 + editor 13 + korean 11 + debounce 8 + title 8 + serialize 4 = 53개 통과

- [ ] **Step 14: 손으로 확인**

Run: `npm run tauri dev`
Expected:
- 제목을 치면 상단바에 나타나고 21번째 글자가 안 들어간다
- 본문에 `# `을 치면 글자가 커지고 `#`이 사라진다
- `- `를 치면 체크박스가 생기고 클릭하면 취소선이 그어진다
- `⋯`를 누르면 색 6개와 "모든 메모 보기"가 뜬다. 색을 고르면 상단바가 바뀐다
- 앱을 껐다 켜면 쓴 내용과 색이 그대로 남아 있다

- [ ] **Step 15: 커밋**

```bash
git add -A
git commit -m "feat: 메모 창 조립 (제목 20자, 자동 저장, 색 메뉴)"
```

---

### Task 7: 드래그 팝업 (B I U ✏)

**Files:**
- Create: `src/editor/bubble.js`, `src/editor/bubble.test.js`
- Modify: `src/note.js`
- Modify: `src/styles/note.css`

**Interfaces:**
- Consumes: Tiptap `Editor` 인스턴스 (Task 5)
- Produces: `bubble.js`: `createBubble({ editor, container }) -> { element, update, destroy }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/editor/bubble.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { typeText } from '../../test/helpers.js'
import { createBubble } from './bubble.js'
import { createEditor } from './editor.js'

let editor
let element
let container
let bubble

beforeEach(() => {
  container = document.createElement('div')
  element = document.createElement('div')
  container.appendChild(element)
  document.body.appendChild(container)
  editor = createEditor({ element, content: '' })
  bubble = createBubble({ editor, container })
})

afterEach(() => {
  bubble.destroy()
  editor.destroy()
  container.remove()
})

describe('드래그 팝업', () => {
  it('버튼이 네 개다 (B I U 형광펜)', () => {
    const keys = [...bubble.element.querySelectorAll('button')].map((b) => b.dataset.mark)
    expect(keys).toEqual(['bold', 'italic', 'underline', 'highlight'])
  })

  it('선택이 없으면 숨어 있다', () => {
    bubble.update()
    expect(bubble.element.hidden).toBe(true)
  })

  it('글자를 선택하면 나타난다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.update()
    expect(bubble.element.hidden).toBe(false)
  })

  it('버튼을 누르면 서식이 적용된다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    bubble.element.querySelector('[data-mark="highlight"]').click()
    expect(editor.getHTML()).toContain('<mark>')
  })

  it('이미 적용된 서식은 눌린 상태로 보인다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    editor.commands.toggleBold()
    bubble.update()
    const boldBtn = bubble.element.querySelector('[data-mark="bold"]')
    expect(boldBtn.getAttribute('aria-pressed')).toBe('true')
    expect(bubble.element.querySelector('[data-mark="italic"]').getAttribute('aria-pressed')).toBe('false')
  })

  it('같은 버튼을 다시 누르면 해제된다', () => {
    typeText(editor, '중요한 부분')
    editor.commands.selectAll()
    const btn = bubble.element.querySelector('[data-mark="bold"]')
    btn.click()
    expect(editor.getHTML()).toContain('<strong>')
    editor.commands.selectAll()
    btn.click()
    expect(editor.getHTML()).not.toContain('<strong>')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- bubble`
Expected: FAIL — `Failed to resolve import "./bubble.js"`

- [ ] **Step 3: `bubble.js` 구현**

```js
/**
 * 드래그하면 뜨는 서식 팝업.
 * 형광펜에 단축키가 없으므로 이 팝업이 형광펜의 유일한 입구다.
 * 익숙한 B I U 옆에 두어 따로 알려주지 않아도 눈에 띄게 한다.
 */
const BUTTONS = [
  { mark: 'bold', label: 'B', command: 'toggleBold', title: '굵게 (Ctrl+B)' },
  { mark: 'italic', label: 'I', command: 'toggleItalic', title: '기울임 (Ctrl+I)' },
  { mark: 'underline', label: 'U', command: 'toggleUnderline', title: '밑줄 (Ctrl+U)' },
  { mark: 'highlight', label: '✏', command: 'toggleHighlight', title: '형광펜' },
]

export function createBubble({ editor, container }) {
  const element = document.createElement('div')
  element.id = 'bubble'
  element.hidden = true
  element.setAttribute('role', 'toolbar')
  element.setAttribute('aria-label', '서식')

  for (const b of BUTTONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.mark = b.mark
    btn.textContent = b.label
    btn.title = b.title
    // 글자만으로는 뜻이 안 통한다. 특히 ✏는 낭독기가 "연필"이라고만 읽는다.
    btn.setAttribute('aria-label', b.title)
    btn.setAttribute('aria-pressed', 'false')
    // mousedown을 막지 않으면 버튼을 누르는 순간 선택이 풀린다.
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      editor.chain().focus()[b.command]().run()
      update()
    })
    element.appendChild(btn)
  }
  container.appendChild(element)

  function update() {
    const { from, to, empty } = editor.state.selection
    if (empty || from === to) {
      element.hidden = true
      return
    }
    element.hidden = false
    for (const b of BUTTONS) {
      element
        .querySelector(`[data-mark="${b.mark}"]`)
        .setAttribute('aria-pressed', String(editor.isActive(b.mark)))
    }
    position()
  }

  function position() {
    // jsdom에는 좌표가 없다. 실제 앱에서만 의미가 있다.
    if (typeof editor.view.coordsAtPos !== 'function') return
    try {
      const { from, to } = editor.state.selection
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      const box = container.getBoundingClientRect()
      const w = element.offsetWidth
      const h = element.offsetHeight

      // 좌우로 가둔다. 그냥 두면 줄 끝을 드래그했을 때 오른쪽 끝의 형광펜 버튼이
      // 창 밖으로 밀려나 눌리지 않는다.
      const centerX = (start.left + end.left) / 2 - box.left
      const maxLeft = Math.max(8, box.width - w - 8)
      element.style.left = `${Math.min(maxLeft, Math.max(8, centerX - w / 2))}px`

      // 위에 자리가 없으면 아래로 내린다. 그대로 두면 첫 줄을 드래그했을 때
      // 팝업이 상단바를 덮는다.
      const above = start.top - box.top - h - 8
      element.style.top = above >= 4 ? `${above}px` : `${end.bottom - box.top + 8}px`
    } catch {
      // 좌표를 못 구하면 위치만 포기하고 팝업은 그대로 둔다.
    }
  }

  /**
   * 본문에서 초점이 떠나면 팝업을 감춘다.
   *
   * 단, 초점이 팝업 버튼으로 옮겨가는 중이면 감추지 않는다. 본문에서 Tab을 누르면
   * 바로 이 팝업으로 오는데, 그때 감춰버리면 키보드로는 형광펜에 영영 닿을 수 없다.
   * blur는 새 요소가 초점을 받기 전에 먼저 오므로 한 박자 뒤에 확인한다.
   */
  const hide = () => {
    setTimeout(() => {
      if (element.contains(document.activeElement)) return
      element.hidden = true
    }, 0)
  }

  /** Esc로 빠져나간다. 이 길이 없으면 팝업에 들어갔다 나오는 방법이 Shift+Tab뿐이다. */
  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    element.hidden = true
    editor.commands.focus()
  }

  element.addEventListener('keydown', onKeyDown)
  editor.on('selectionUpdate', update)
  editor.on('blur', hide)

  return {
    element,
    update,
    destroy() {
      element.removeEventListener('keydown', onKeyDown)
      editor.off('selectionUpdate', update)
      editor.off('blur', hide)
      element.remove()
    },
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- bubble`
Expected: PASS — 12개 통과

- [ ] **Step 5: 팝업 스타일 추가**

`src/styles/note.css` 맨 아래:

```css
#bubble {
  position: absolute;
  z-index: 20;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 5px;
  background: #2e2e2c;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
}
#bubble[hidden] { display: none; }

#bubble button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #f2f0ea;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
#bubble button:hover { background: rgba(255, 255, 255, 0.16); }
#bubble button[aria-pressed='true'] { background: rgba(255, 255, 255, 0.3); }
#bubble button[data-mark='italic'] { font-style: italic; }
#bubble button[data-mark='bold'] { font-weight: 700; }
#bubble button[data-mark='underline'] { text-decoration: underline; }
```

- [ ] **Step 6: `note.js`에 연결**

import 구문에 추가:

```js
import { createBubble } from './editor/bubble.js'
```

`boot()` 안에서 `editor = createEditor({...})` **바로 다음** 줄에 추가:

```js
  createBubble({ editor, container: shell })
```

- [ ] **Step 7: 손으로 확인**

Run: `npm run tauri dev`
Expected: 본문에 글을 쓰고 드래그하면 검은 팝업에 `B I U ✏`가 뜬다. `✏`를 누르면 노랗게 칠해지고, 다시 드래그하면 그 버튼이 눌린 상태로 보인다. `Ctrl+B`도 동작한다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 드래그 서식 팝업 (B I U 형광펜)"
```

---

### Task 8: 목록 창

**Files:**
- Create: `src/lib/preview.js`, `src/lib/preview.test.js`
- Create: `src/lib/search.js`, `src/lib/search.test.js`
- Create: `src/styles/list.css`
- Modify: `src/list.html`, `src/list.js`
- Modify: `src/styles/note.css`, `src/styles/tokens.css` (`.bar-btn` 규칙을 공용 위치로 이동 — Step 8 참고)

**Interfaces:**
- Consumes: `listNotes`, `openNoteWindow`, `deleteNote`, `createNote` (Task 6), `colorOf` (Task 4)
- Produces:
  - `preview.js`: `firstLine(text)`, `previewText(text, maxChars = 60)`
  - `search.js`: `filterNotes(summaries, query)`

- [ ] **Step 1: `preview`의 실패하는 테스트 작성**

`src/lib/preview.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { firstLine, previewText } from './preview.js'

describe('firstLine', () => {
  it('첫 줄만 돌려준다', () => {
    expect(firstLine('장보기\n운동\n세탁')).toBe('장보기')
  })

  it('빈 앞줄은 건너뛴다', () => {
    expect(firstLine('\n\n실제 첫 줄')).toBe('실제 첫 줄')
  })

  it('내용이 없으면 빈 문자열이다', () => {
    expect(firstLine('')).toBe('')
    expect(firstLine('\n\n')).toBe('')
    expect(firstLine(null)).toBe('')
  })
})

describe('previewText', () => {
  it('줄바꿈을 가운뎃점으로 잇는다', () => {
    expect(previewText('장보기\n운동')).toBe('장보기 · 운동')
  })

  it('길면 잘라내고 말줄임을 붙인다', () => {
    expect(previewText('가'.repeat(100), 10)).toBe(`${'가'.repeat(10)}…`)
  })

  it('짧으면 말줄임을 붙이지 않는다', () => {
    expect(previewText('짧다', 10)).toBe('짧다')
  })

  it('빈 내용은 빈 문자열이다', () => {
    expect(previewText('')).toBe('')
    expect(previewText(null)).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- preview`
Expected: FAIL — `Failed to resolve import "./preview.js"`

- [ ] **Step 3: `preview.js` 구현**

```js
/** 제목이 비어 있을 때 목록 카드에 대신 보여줄 본문 첫 줄. */
export function firstLine(text) {
  if (!text) return ''
  return text.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
}

/** 목록 카드의 2줄 미리보기. 줄바꿈을 가운뎃점으로 이어 한 덩어리로 만든다. */
export function previewText(text, maxChars = 60) {
  if (!text) return ''
  const flat = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' · ')
  return flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- preview`
Expected: PASS — 7개 통과

- [ ] **Step 5: `search`의 실패하는 테스트 작성**

`src/lib/search.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { filterNotes } from './search.js'

const NOTES = [
  { id: '1', title: '이번주 할일', text: '장보기\n운동' },
  { id: '2', title: '외주 아이디어', text: '사용자가 고를 게 없어야 한다' },
  { id: '3', title: '', text: 'Project Alpha Q3' },
]

describe('filterNotes', () => {
  it('검색어가 비면 전부 돌려준다', () => {
    expect(filterNotes(NOTES, '')).toHaveLength(3)
    expect(filterNotes(NOTES, '   ')).toHaveLength(3)
  })

  it('제목에서 찾는다', () => {
    expect(filterNotes(NOTES, '외주').map((n) => n.id)).toEqual(['2'])
  })

  it('본문에서도 찾는다', () => {
    expect(filterNotes(NOTES, '장보기').map((n) => n.id)).toEqual(['1'])
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(filterNotes(NOTES, 'project').map((n) => n.id)).toEqual(['3'])
    expect(filterNotes(NOTES, 'ALPHA').map((n) => n.id)).toEqual(['3'])
  })

  it('맞는 게 없으면 빈 배열이다', () => {
    expect(filterNotes(NOTES, '존재하지않는단어')).toEqual([])
  })

  it('초성 검색은 지원하지 않는다', () => {
    expect(filterNotes(NOTES, 'ㅇㅈ')).toEqual([])
  })
})
```

- [ ] **Step 6: 테스트 실패 → 구현 → 통과**

Run: `npm test -- search`
Expected: FAIL — `Failed to resolve import "./search.js"`

`src/lib/search.js`:

```js
/**
 * 대소문자를 구분하지 않는 단순 부분 일치.
 * 초성 검색과 정규식은 의도적으로 지원하지 않는다.
 */
export function filterNotes(summaries, query) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return summaries
  return summaries.filter(
    (n) =>
      (n.title ?? '').toLowerCase().includes(q) ||
      (n.text ?? '').toLowerCase().includes(q),
  )
}
```

Run: `npm test -- search`
Expected: PASS — 6개 통과

- [ ] **Step 7: `list.html` 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>모든 메모</title>
  </head>
  <body>
    <div id="shell">
      <div id="listbar" data-tauri-drag-region>
        <input id="search" type="search" placeholder="검색" />
        <button class="bar-btn" id="new-note" title="새 메모 (Ctrl+Alt+N)">+</button>
        <button class="bar-btn" id="close" title="닫기">×</button>
      </div>
      <div id="cards"></div>
      <p id="empty" hidden>메모가 없습니다.</p>
    </div>
    <script type="module" src="./list.js"></script>
  </body>
</html>
```

- [ ] **Step 8: `list.css` 작성**

```css
#shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--nfj-paper);
  border-radius: var(--nfj-radius);
  overflow: hidden;
}

#listbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 8px;
  background: #ece8e0;
  color: var(--nfj-ink);
}

#search {
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  padding: 0 9px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 13px;
  background: #ffffff;
  color: var(--nfj-ink);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

#cards { flex: 1 1 auto; overflow-y: auto; }

.card {
  display: flex;
  gap: 10px;
  padding: 11px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
}
.card:hover { background: rgba(0, 0, 0, 0.04); }

.card-stripe { flex: 0 0 auto; width: 5px; border-radius: 3px; }
.card-body { flex: 1 1 auto; min-width: 0; }

.card-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-title.untitled { font-weight: 400; opacity: 0.55; }

.card-preview {
  margin-top: 3px;
  font-size: var(--nfj-preview-size);
  line-height: 1.5;
  opacity: 0.65;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

#empty {
  margin: 40px 0;
  text-align: center;
  font-size: 13px;
  opacity: 0.5;
}
#empty[hidden] { display: none; }
```

`.bar-btn` 규칙은 `note.css`에 있으므로 목록 창에서도 써야 한다. **`note.css`의 `.bar-btn` 블록을 통째로 `src/styles/bar.css`로 옮기고**, `note.js`와 `list.js` 양쪽에서 불러온다. `tokens.css`로 옮기지 않는 이유는 그 파일이 변수와 기본 초기화만 담는 자리이기 때문이다 — 컴포넌트 규칙이 섞이면 한 요소의 스타일이 여러 파일에 흩어지고, 그때부터는 불러오는 순서가 승패를 가른다.

- [ ] **Step 9: `list.js` 구현**

```js
import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/list.css'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { createNote, deleteNote, listNotes, openNoteWindow } from './lib/api.js'
import { colorOf } from './lib/colors.js'
import { firstLine, previewText } from './lib/preview.js'
import { installResizeZones } from './lib/resize.js'
import { filterNotes } from './lib/search.js'

installResizeZones()

const cards = document.getElementById('cards')
const empty = document.getElementById('empty')
const search = document.getElementById('search')

let all = []

function render() {
  const shown = filterNotes(all, search.value)
  cards.textContent = ''
  empty.hidden = shown.length > 0

  for (const n of shown) {
    const card = document.createElement('div')
    card.className = 'card'

    const stripe = document.createElement('div')
    stripe.className = 'card-stripe'
    stripe.style.background = colorOf(n.color).bar

    const body = document.createElement('div')
    body.className = 'card-body'

    const title = document.createElement('div')
    const hasTitle = (n.title ?? '').trim().length > 0
    title.className = hasTitle ? 'card-title' : 'card-title untitled'
    title.textContent = hasTitle ? n.title : firstLine(n.text) || '(빈 메모)'

    const preview = document.createElement('div')
    preview.className = 'card-preview'
    preview.textContent = previewText(n.text)

    body.append(title, preview)
    card.append(stripe, body)

    card.addEventListener('click', () => openNoteWindow(n.id))
    card.addEventListener('contextmenu', async (e) => {
      e.preventDefault()
      const label = hasTitle ? n.title : '제목 없는 메모'
      if (confirm(`"${label}" 메모를 삭제할까요?\n되돌릴 수 없습니다.`)) {
        await deleteNote(n.id)
        await refresh()
      }
    })

    cards.appendChild(card)
  }
}

async function refresh() {
  all = await listNotes()
  render()
}

search.addEventListener('input', render)
document.getElementById('new-note').addEventListener('click', async () => {
  await createNote()
  await refresh()
})
document.getElementById('close').addEventListener('click', () => getCurrentWindow().hide())

// 창이 다시 보일 때마다 최신 상태로 맞춘다.
getCurrentWindow().onFocusChanged(({ payload }) => {
  if (payload) refresh()
})

refresh()
```

- [ ] **Step 10: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 53 + bubble 12 + preview 7 + search 6 = 78개 통과

- [ ] **Step 11: 손으로 확인**

Run: `npm run tauri dev`
Expected: 메모 창의 `⋯` → "모든 메모 보기"로 목록 창이 열린다. 메모 카드에 색 띠와 제목이 보이고, 제목 없는 메모는 본문 첫 줄이 회색으로 보인다. 검색어를 치면 즉시 걸러지고, 카드를 우클릭하면 삭제 확인이 뜬다. 삭제하면 그 메모 창도 같이 닫힌다.

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: 목록 창 (카드, 검색, 삭제)"
```

---

### Task 9: 시스템 연동 — 자동 실행, 전역 단축키, 단일 인스턴스

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: `commands::AppPaths`, `windows::open_list`, `commands::create_note` 경로
- Produces: 앱 수준 동작 — 윈도우 시작 시 자동 실행, `Ctrl+Alt+N`, 두 번째 실행 시 기존 앱의 목록 창 띄우기

- [ ] **Step 1: 플러그인 의존성 추가**

`src-tauri/Cargo.toml`의 `[dependencies]`에 추가:

```toml
tauri-plugin-autostart = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-single-instance = "2"
```

Run: `cd src-tauri && cargo build`
Expected: 세 크레이트가 받아지고 빌드가 통과한다.

- [ ] **Step 2: 새 메모 생성 로직을 재사용 가능하게 분리**

`src-tauri/src/commands.rs`의 `create_note`는 `State<AppPaths>`를 받아 단축키 핸들러에서 부르기 어렵다. `AppHandle`만으로 동작하는 함수를 하나 두고 명령이 그것을 부르게 바꾼다.

`commands.rs`의 `create_note`를 아래로 교체한다:

```rust
/// 단축키 핸들러처럼 State를 쓸 수 없는 곳에서도 부를 수 있도록 AppHandle만 받는다.
pub fn create_note_with(app: &AppHandle) -> Result<String, String> {
    let notes = {
        let paths = app.state::<AppPaths>();
        paths.notes.clone()
    };
    let mut note = new_note(&notes);

    // 좌표 단위를 섞지 않도록 windows.rs의 헬퍼를 쓴다 (논리 픽셀).
    let last = windows::last_window_position(app);
    let screen = windows::primary_screen_logical(app);
    let (x, y) = windows::next_position(last, screen, (note.window.width, note.window.height));
    note.window.x = x;
    note.window.y = y;

    storage::save(&notes, &note).map_err(|e| e.to_string())?;
    windows::open_note(app, &note).map_err(|e| e.to_string())?;
    Ok(note.id)
}

#[tauri::command]
pub fn create_note(app: AppHandle) -> Result<String, String> {
    create_note_with(&app)
}
```

`use tauri::{AppHandle, Manager, State};`로 import에 `Manager`를 추가한다.

- [ ] **Step 3: 테스트로 회귀 확인**

Run: `cd src-tauri && cargo test`
Expected: PASS — 기존 27개 전부 통과 (windows 5 + storage 11 + html 6 + note 2 + commands 3)

- [ ] **Step 4: `lib.rs`에 플러그인 등록**

`src-tauri/src/lib.rs`의 `run()`을 아래로 교체한다:

```rust
pub fn run() {
    tauri::Builder::default()
        // 두 번째 실행은 새 앱을 띄우지 않고 이미 떠 있는 앱의 목록 창을 보여준다.
        // 작업표시줄 아이콘을 눌렀을 때 기대하는 동작이다.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = windows::open_list(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let base = app
                .path()
                .data_dir()
                .expect("데이터 폴더를 찾을 수 없습니다")
                .join("NoteforJun");
            let notes = storage::notes_dir(&base);
            std::fs::create_dir_all(&notes)?;
            app.manage(AppPaths { notes: notes.clone() });

            register_shortcut(app.handle())?;
            enable_autostart(app.handle());

            windows::restore_all(app.handle(), &notes)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_notes,
            commands::load_note,
            commands::save_note,
            commands::create_note,
            commands::delete_note,
            commands::open_note_window,
            commands::hide_note_window,
            commands::open_list_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteforJun");
}

fn register_shortcut(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
    let handle = app.clone();
    app.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, sc, event| {
                if sc == &hotkey && event.state() == ShortcutState::Pressed {
                    let _ = commands::create_note_with(&handle);
                }
            })
            .build(),
    )?;
    app.global_shortcut().register(hotkey)?;
    Ok(())
}

fn enable_autostart(app: &tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if manager.is_enabled().unwrap_or(false) {
        return;
    }
    // 설정 화면이 없으므로 설치 즉시 켠다. 끄고 싶으면 윈도우 시작 프로그램에서 끈다.
    let _ = manager.enable();
}
```

`lib.rs` 맨 위 import를 아래로 맞춘다:

```rust
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::commands::AppPaths;
```

`register_shortcut`에서 플러그인을 다시 등록하므로 `run()`의 체인에 있던 `.plugin(tauri_plugin_global_shortcut::Builder::new().build())` 한 줄은 **지운다**. 핸들러가 붙은 쪽만 남겨야 한다.

**이 단계는 컴파일이 한 번에 통과하지 않을 수 있다.** 전역 단축키 플러그인은 핸들러를 빌더에 붙여야 하는데 핸들러가 `AppHandle`을 필요로 해서 순환이 생긴다. 위 코드는 `setup` 안에서 플러그인을 등록하는 방식으로 이를 푼다. `AppHandle::plugin` 시그니처가 맞지 않거나 소유권 오류가 나면, 아래 대안으로 바꾼다 — 동작은 같다.

대안: `run()` 체인에서 핸들러까지 한 번에 붙이고, 핸들러 안에서 이벤트로 전달받은 `app` 인자를 쓴다.

```rust
.plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, sc, event| {
            use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
            let is_hotkey = sc.mods == Modifiers::CONTROL | Modifiers::ALT && sc.key == Code::KeyN;
            if is_hotkey && event.state() == ShortcutState::Pressed {
                let _ = commands::create_note_with(app);
            }
        })
        .build(),
)
```

이 경우 `setup` 안에서는 등록만 한다:

```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
app.global_shortcut()
    .register(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN))?;
```

둘 중 컴파일되는 쪽을 쓰고, 어느 쪽을 썼는지 보고서에 적는다.

- [ ] **Step 5: 실행 확인**

Run: `npm run tauri dev`
Expected:
- 앱이 뜬 상태에서 `Ctrl+Alt+N`을 누르면 새 메모 창이 마지막 창에서 오른쪽 아래로 비껴 뜬다
- 창을 하나도 안 띄운 상태에서 앱을 한 번 더 실행하면 새 창이 아니라 목록 창이 뜬다

- [ ] **Step 6: 자동 실행 등록 확인**

Run: `npm run tauri dev` 후 PowerShell에서:

```powershell
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' | Select-Object -Property *NoteforJun*
```

Expected: NoteforJun 항목이 보인다. 개발 모드에서는 개발 실행 파일 경로가 등록되므로, 배포 빌드 후 다시 확인하는 것이 정확하다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 자동 실행, 전역 단축키, 단일 인스턴스"
```

- [ ] **Step 8: (선택) 작업표시줄 점프 목록**

설계 문서 §11.4에 따라 **여기까지만 하고 넘어가도 된다.** 점프 목록은 윈도우 COM(`ICustomDestinationList`)을 직접 호출해야 해서 `unsafe` 코드가 상당량 필요하다. 시도해서 한 번에 되지 않으면 생략하고, 아래 두 경로가 이미 같은 일을 한다는 것을 확인한 뒤 넘어간다:

- 작업표시줄 아이콘 클릭 → 목록 창 (Step 4의 single-instance가 처리)
- `Ctrl+Alt+N` → 새 메모

생략하기로 했다면 설계 문서 §11.4의 해당 문단 아래에 한 줄 덧붙인다: `구현 결과: 생략함. 아이콘 클릭 → 목록 창으로 대체.`

---

### Task 10: 완성 기준 검증과 배포 빌드

**Files:**
- Create: `docs/superpowers/plans/2026-09-11-noteforjun-checklist.md`
- Modify: 검증 중 발견된 문제에 해당하는 파일

**Interfaces:**
- Consumes: Task 1~9 전부
- Produces: 설계 문서 §12의 완성 기준 20개에 대한 통과 기록, 그리고 설치 가능한 `.msi`

- [ ] **Step 1: 자동 테스트 전체 실행**

Run: `npm test`
Expected: PASS — 78개

Run: `cd src-tauri && cargo test`
Expected: PASS — 27개

- [ ] **Step 2: 배포 빌드**

Run: `npm run tauri build`
Expected: `src-tauri/target/release/bundle/msi/` 아래에 `.msi`가 생긴다. 설치해서 그 앱으로 이후 항목을 확인한다.

- [ ] **Step 3: 체크리스트 문서 작성**

`docs/superpowers/plans/2026-09-11-noteforjun-checklist.md`에 아래를 그대로 쓰고, 항목마다 직접 확인하며 채운다.

```markdown
# NoteforJun 완성 기준 확인

설계 문서 `docs/superpowers/specs/2026-09-11-noteforjun-design.md` §12 기준.
확인 날짜: ____  /  빌드: ____

## 서식
- [ ] 1. `# ` + 띄어쓰기로 큰 글씨가 되고 `#` 기호가 남지 않는다
- [ ] 2. `- `와 `[] `가 각각 체크박스로 변환된다
- [ ] 3. 체크박스 클릭 시 취소선과 흐림이 적용되고 위치는 바뀌지 않는다
- [ ] 4. 체크박스에서 Enter → 다음 체크박스 / 빈 체크박스에서 Enter → 목록 탈출
- [ ] 5. 드래그 시 `B I U ✏` 팝업이 뜨고 네 버튼이 적용·해제된다
- [ ] 6. `Ctrl+B` / `Ctrl+I` / `Ctrl+U`가 동작한다
- [ ] 7. 이미 서식이 적용된 부분을 선택하면 해당 버튼이 눌린 상태로 보인다
- [ ] (추가) `## `를 쳐도 아무 일이 일어나지 않는다

## 한글 입력 — 자동화 불가, 반드시 손으로 확인

`src/editor/korean.test.js`가 "조합이 끝난 뒤 글자와 구조가 온전한가"는 이미 검증한다.
아래는 그 테스트가 원리적으로 확인할 수 없는 것들이다 — jsdom에는 IME가 없어서
조합 **도중**의 화면과 커서는 실제로 쳐 봐야만 알 수 있다.

### 조합 중 화면
- [ ] 8. `ㅎ` → `하` → `한` 조합 도중 글자가 깜빡이거나 커서가 튀지 않는다
- [ ] 조합 도중 글자가 두 번 나타났다 사라지는 현상이 없다
- [ ] 백스페이스로 `한` → `하` → `ㅎ` 순으로 낱자가 하나씩 지워진다
- [ ] 조합 중 방향키를 눌러도 글자가 깨지지 않는다
- [ ] 한자 변환(한글 입력 후 한자 키)이 동작하고, 변환 후 서식이 유지된다

### 조합 중 자동 저장 — 글이 날아가면 가장 치명적인 지점
- [ ] 9. 한 글자를 조합하다 멈추고 1초 기다린 뒤 이어서 쳐도 글자가 유실되지 않는다
- [ ] 조합 도중 창을 옮겨도(그때도 저장이 일어난다) 글자가 유실되지 않는다
- [ ] 조합 도중 `×`로 창을 닫았다 다시 열면, 조합하던 글자까지 남아 있다

### 서식과 함께
- [ ] 큰 글씨(`# `) 줄에서 한글을 쳐도 크기가 유지된다
- [ ] 체크박스 안에서 한글을 치고 Enter를 눌러도 앞 항목의 한글이 남는다
- [ ] 한글을 드래그하면 `B I U ✏` 팝업이 뜨고, 형광펜이 글자에 정확히 걸린다
- [ ] 한글 한 글자만 드래그해서 서식을 걸어도 앞뒤 글자가 영향받지 않는다

### 제목 칸
- [ ] 제목 칸에서 한글을 조합해 20자를 채우면 21번째가 들어가지 않는다
- [ ] 20번째 글자를 조합하는 도중에 잘려서 낱자만 남는 일이 없다
- [ ] 한글 제목이 목록 창에서 온전히 보인다

### 저장 파일
- [ ] 저장 폴더의 JSON을 메모장으로 열었을 때 한글이 깨지지 않는다
- [ ] 앱을 껐다 켜도 한글이 그대로다 (인코딩 왕복 확인)

## 저장과 복원
- [ ] 10. 메모를 쓰는 도중 작업 관리자로 강제 종료해도 0.5초 이전까지 쓴 글이 남아 있다
- [ ] 11. `%APPDATA%\NoteforJun\notes\`의 JSON 하나를 메모장으로 열어 망가뜨려도 다른 메모는 정상적으로 열린다
- [ ] 12. 재부팅 후 열려 있던 메모가 같은 자리, 같은 크기로 복원된다
- [ ] 13. `×`로 닫은 메모가 목록 창에 남아 있고, 클릭하면 다시 열린다

## 제목과 목록
- [ ] 14. 제목에 21번째 글자가 입력되지 않는다
- [ ] 15. 메모 창에서 잘린 제목이 목록 창에서는 전부 보인다
      확인법: `6월 일본여행 계획(오사카)` (15자)를 넣고 창을 220px까지 줄인다
- [ ] 16. 제목이 빈 메모는 목록에서 본문 첫 줄이 회색으로 표시된다
- [ ] 17. 검색어를 입력하면 제목과 본문 양쪽에서 걸러진다
- [ ] (추가) 목록 창을 360px 아래로 줄일 수 없다

## 성능과 철학
- [ ] 18. 메모 20개를 띄웠을 때 메모리 사용량이 250MB 아래
      확인법: 작업 관리자 → 세부 정보 → NoteforJun 관련 프로세스 메모리 합계
- [ ] 19. 새 메모 창이 뜨기까지 0.5초 이내
- [ ] 20. 설정 화면이 없다. 조절 가능한 것은 색 6가지와 창 크기·위치뿐이다

## 시스템 연동
- [ ] `Ctrl+Alt+N`으로 새 메모가 뜬다
- [ ] 작업표시줄에 고정한 아이콘을 누르면 목록 창이 뜬다
- [ ] 윈도우 재시작 후 앱이 자동으로 실행된다

## 발견된 문제
(없으면 "없음")
```

- [ ] **Step 4: 메모리 측정**

메모 20개를 띄우고 작업 관리자에서 NoteforJun 관련 프로세스 메모리를 합산한다. 250MB를 넘으면 원인을 기록한다. WebView2 프로세스는 여러 개로 나뉘어 보이므로 전부 더해야 한다.

- [ ] **Step 5: 발견된 문제 수정**

체크리스트에서 실패한 항목이 있으면 각각을 별도 커밋으로 고친다. 고칠 때마다 `npm test`와 `cargo test`를 다시 돌린다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "docs: 완성 기준 확인 결과"
```

---

## Self-Review

**1. 설계 문서 커버리지**

| 설계 문서 절 | 담당 태스크 |
|---|---|
| §4.1 메모 창 (상단바, 4요소) | Task 4, 6 |
| §4.2 목록 창 (검색, 카드, 정렬, 삭제) | Task 8 |
| §5.1 타이핑 서식 (`# `, `- `, `[] `) | Task 5 |
| §5.2 선택 서식 (B I U 형광펜) | Task 5, 7 |
| §6 색 6종, 기본 노랑 | Task 4, 6 |
| §7 타이포그래피, 폰트 포함 | Task 4 |
| §8 제목 20자, 말줄임, 빈 제목 | Task 6, 8 |
| §9 창 동작, 새 메모 3경로, 캐스케이드 | Task 3, 9 |
| §10 저장 위치·형식·원자성·디바운스 | Task 2, 3, 6 |
| §11 기술 구조, Rust 4역할, 명령 8종 | Task 1, 2, 3, 9 |
| §12 완성 기준 20개 | Task 10 |

빠진 항목 없음.

**2. 설계 문서와 달라진 점 (의도적)**

- §11.5의 `list_notes`는 "요약 목록"이라고만 적혀 있었다. 검색이 본문 전체를 훑어야 하므로 `NoteSummary`에 본문 전체의 순수 텍스트인 `text` 필드를 넣었다. 미리보기는 이 `text`에서 프론트엔드가 잘라 쓴다.
- §11.5에 없던 `close_note`를 `windows.rs`에 추가했다. 메모를 삭제할 때 열려 있는 창을 닫아야 하는데 `hide`로는 부족하다.

**3. 타입·이름 일관성 확인**

- Rust: `storage::{notes_dir, save, load, list, delete}` / `html::strip_html` / `windows::{next_position, note_label, LIST_LABEL, open_note, hide_note, close_note, open_list, restore_all}` / `commands::{AppPaths, new_note, create_note_with, 명령 8종}` — 전 태스크에서 동일하게 사용됨
- JS: `api.js`의 8개 함수명이 Rust 명령의 camelCase 대응과 일치. `colorOf`, `COLORS`, `DEFAULT_COLOR`, `clampTitle`, `TITLE_MAX`, `firstLine`, `previewText`, `filterNotes`, `debounce`, `createEditor`, `buildExtensions`, `createBubble`, `TASK_INPUT_RULE` — 정의된 태스크와 사용하는 태스크의 철자가 일치
- `NoteSummary`의 JSON 키는 `serde(rename_all = "camelCase")`로 `updatedAt`이 되고, `search.js`/`list.js`는 `n.title`, `n.text`, `n.color`, `n.id`만 읽으므로 충돌 없음
- `.bar-btn` 규칙이 `note.css`에 있는데 `list.html`도 쓰므로 Task 8 Step 8에서 `tokens.css`로 옮기도록 명시함
