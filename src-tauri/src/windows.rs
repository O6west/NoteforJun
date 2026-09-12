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

/// 앱을 켰을 때 무엇을 띄울지.
#[derive(Debug, PartialEq)]
pub enum Startup {
    /// 빈 메모를 하나 만들어 띄운다
    NewNote,
    /// 이 메모들을 띄운다
    Restore(Vec<String>),
}

/// 켜질 때 무엇을 띄울지 정한다.
///
/// 아무것도 안 띄우는 선택지는 없다. 메모 창에는 OS 테두리가 없고 트레이 아이콘도
/// 쓰지 않으므로, 창이 하나도 없으면 앱은 켜져 있는데 사용자가 닿을 방법이 없다.
/// 마지막 메모를 × 로 닫고 재시작하면 바로 그 상태가 된다.
///
/// 전부 숨겨져 있을 때 빈 메모를 내미는 이유는 이 앱의 쓰임새 때문이다 —
/// 생각났을 때 바로 적는 것이지, 목록부터 보는 게 아니다.
/// 다만 매번 새로 만들면 껐다 켤 때마다 빈 메모가 쌓이므로,
/// 이미 비어 있는 메모가 있으면 그것을 다시 띄운다.
pub fn startup_plan(visible: Vec<String>, empty: Vec<String>) -> Startup {
    if !visible.is_empty() {
        return Startup::Restore(visible);
    }
    match empty.into_iter().next() {
        Some(id) => Startup::Restore(vec![id]),
        None => Startup::NewNote,
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
        // 최대화를 막는다. 상단바를 더블클릭하면 Tauri가 최대화하는데, 우리 창에는
        // OS 제목 표시줄이 없어 되돌릴 버튼이 없다. 한번 최대화되면 빠져나올 길이
        // 사라지고, 메모 창은 크기를 기억하므로 그 크기가 그대로 저장된다.
        // 크게 쓰고 싶으면 가장자리를 끌면 된다.
        // (이미 최대화된 창을 되돌리는 것은 Tauri가 여전히 허용한다)
        .maximizable(false)
        // 작업표시줄에서 숨기지 않는다. 메모가 여러 개여도 윈도우가 아이콘 하나로
        // 묶어주므로 지저분해지지 않고, 숨기면 메모 창만 떠 있을 때 앱이
        // 작업표시줄에서 완전히 사라져 다시 닿을 방법이 없어진다.
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
        // 최대화를 막는다. 상단바를 더블클릭하면 Tauri가 최대화하는데, 우리 창에는
        // OS 제목 표시줄이 없어 되돌릴 버튼이 없다. 한번 최대화되면 빠져나올 길이
        // 사라지고, 메모 창은 크기를 기억하므로 그 크기가 그대로 저장된다.
        // 크게 쓰고 싶으면 가장자리를 끌면 된다.
        // (이미 최대화된 창을 되돌리는 것은 Tauri가 여전히 허용한다)
        .maximizable(false)
        .build()?;
    Ok(())
}

/// 앱을 켤 때 호출한다.
///
/// 열어둔 채 껐던 메모를 그대로 되살린다 — 책상을 원래대로 돌려놓는 일이다.
/// 되살릴 게 없으면 적을 수 있는 빈 메모를 내민다. 이미 비어 있는 메모가
/// 있으면 그것을 다시 띄우고, 없을 때만 새로 만든다.
pub fn restore_all(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    let visible: Vec<String> = notes
        .iter()
        .filter(|n| n.window.visible)
        .map(|n| n.id.clone())
        .collect();
    apply(app, notes_dir, &notes, startup_plan(visible, blank_ids(&notes)))
}

/// 작업표시줄 아이콘을 눌렀을 때. 적을 수 있는 빈 메모를 내민다.
///
/// 켤 때와 달리 이미 떠 있는 메모는 따지지 않는다. 아이콘을 눌렀다는 것은
/// 무언가 적을 자리를 달라는 뜻이지, 어제 보던 것을 다시 보자는 뜻이 아니다.
pub fn open_blank(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    apply(app, notes_dir, &notes, startup_plan(vec![], blank_ids(&notes)))
}

fn load_all(notes_dir: &PathBuf) -> Vec<Note> {
    storage::list(notes_dir)
        .unwrap_or_default()
        .iter()
        .filter_map(|s| storage::load(notes_dir, &s.id).ok())
        .collect()
}

fn blank_ids(notes: &[Note]) -> Vec<String> {
    notes.iter().filter(|n| is_blank(n)).map(|n| n.id.clone()).collect()
}

fn apply(
    app: &AppHandle,
    notes_dir: &PathBuf,
    notes: &[Note],
    plan: Startup,
) -> tauri::Result<()> {
    match plan {
        Startup::NewNote => {
            let mut note = crate::commands::new_note();
            let screen = primary_screen_logical(app);
            let (x, y) = next_position(None, screen, (note.window.width, note.window.height));
            note.window.x = x;
            note.window.y = y;
            let _ = storage::save(notes_dir, &note);
            open_note(app, &note)
        }
        Startup::Restore(ids) => {
            for note in notes.iter().filter(|n| ids.contains(&n.id)) {
                if note.window.visible {
                    open_note(app, note)?;
                    continue;
                }
                // 숨겨져 있던 메모를 되살릴 때만 기록을 고친다.
                // 이미 보이는 메모까지 저장하면 켤 때마다 쓸데없는 디스크 쓰기가 생긴다.
                let mut note = note.clone();
                note.window.visible = true;
                let _ = storage::save(notes_dir, &note);
                open_note(app, &note)?;
            }
            Ok(())
        }
    }
}

/// 제목도 본문도 비어 있는 메모. 다시 내밀어도, 지워도 사용자가 잃을 것이 없다.
pub fn is_blank(note: &Note) -> bool {
    note.title.trim().is_empty() && crate::html::strip_html(&note.content).trim().is_empty()
}

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
    fn nothing_to_show_creates_a_blank_note() {
        // 메모가 아예 없을 때와, 메모는 있지만 전부 숨겨졌고 빈 것도 없을 때가
        // 같은 입력으로 모인다. 둘 다 아무것도 안 띄우면 앱에 닿을 수 없게 된다.
        assert_eq!(startup_plan(vec![], vec![]), Startup::NewNote);
    }

    #[test]
    fn visible_notes_are_restored() {
        assert_eq!(
            startup_plan(vec!["a".to_string(), "b".to_string()], vec![]),
            Startup::Restore(vec!["a".to_string(), "b".to_string()])
        );
    }

    #[test]
    fn blank_means_no_title_and_no_body_text() {
        let mut n = crate::note::Note {
            id: "x".to_string(),
            title: String::new(),
            content: "<p></p>".to_string(),
            color: "yellow".to_string(),
            window: crate::note::WindowState::default(),
            created_at: "2026-09-12T00:00:00Z".to_string(),
            updated_at: "2026-09-12T00:00:00Z".to_string(),
        };
        assert!(is_blank(&n));

        n.content = "<p>적어둔 것</p>".to_string();
        assert!(!is_blank(&n), "본문이 있으면 빈 메모가 아니다");

        n.content = "<p></p>".to_string();
        n.title = "제목만".to_string();
        assert!(!is_blank(&n), "제목이 있으면 빈 메모가 아니다");
    }

    #[test]
    fn all_hidden_reuses_an_existing_blank_note() {
        // 매번 새로 만들면 껐다 켤 때마다 빈 메모가 쌓인다
        assert_eq!(
            startup_plan(vec![], vec!["blank".to_string()]),
            Startup::Restore(vec!["blank".to_string()])
        );
    }

    #[test]
    fn visible_notes_win_over_a_blank_one() {
        assert_eq!(
            startup_plan(vec!["open".to_string()], vec!["blank".to_string()]),
            Startup::Restore(vec!["open".to_string()])
        );
    }

    #[test]
    fn label_is_prefixed() {
        assert_eq!(note_label("abc-123"), "note-abc-123");
    }
}
