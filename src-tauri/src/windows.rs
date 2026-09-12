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
    /// 메모가 하나도 없다 — 빈 메모를 하나 만들어 띄운다
    NewNote,
    /// 열어둔 채 껐던 메모들을 되살린다
    Restore(Vec<String>),
    /// 메모는 있는데 전부 숨겨져 있다 — 목록 창을 띄운다
    List,
}

/// 켜질 때 무엇을 띄울지 정한다.
///
/// 세 번째 경우가 핵심이다. 메모가 있는데 전부 숨겨져 있을 때 아무것도 띄우지
/// 않으면, 앱은 켜져 있는데 화면에는 아무것도 없다. 메모 창에는 OS 테두리가 없고
/// 트레이 아이콘도 쓰지 않으므로, 그 상태에서 사용자가 앱에 다시 닿을 방법이 없다.
/// 마지막 메모를 × 로 닫고 앱을 재시작하면 바로 이 상태가 된다.
pub fn startup_plan(total: usize, visible: Vec<String>) -> Startup {
    if total == 0 {
        Startup::NewNote
    } else if visible.is_empty() {
        Startup::List
    } else {
        Startup::Restore(visible)
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
    let notes: Vec<Note> = storage::list(notes_dir)
        .unwrap_or_default()
        .iter()
        .filter_map(|s| storage::load(notes_dir, &s.id).ok())
        .collect();
    let visible: Vec<String> = notes
        .iter()
        .filter(|n| n.window.visible)
        .map(|n| n.id.clone())
        .collect();

    match startup_plan(notes.len(), visible) {
        Startup::NewNote => {
            let mut note = crate::commands::new_note(notes_dir);
            let screen = primary_screen_logical(app);
            let (x, y) = next_position(None, screen, (note.window.width, note.window.height));
            note.window.x = x;
            note.window.y = y;
            let _ = storage::save(notes_dir, &note);
            open_note(app, &note)
        }
        Startup::List => open_list(app),
        Startup::Restore(ids) => {
            for note in notes.iter().filter(|n| ids.contains(&n.id)) {
                open_note(app, note)?;
            }
            Ok(())
        }
    }
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
    fn no_notes_at_all_creates_one() {
        assert_eq!(startup_plan(0, vec![]), Startup::NewNote);
    }

    #[test]
    fn visible_notes_are_restored() {
        assert_eq!(
            startup_plan(3, vec!["a".to_string(), "b".to_string()]),
            Startup::Restore(vec!["a".to_string(), "b".to_string()])
        );
    }

    #[test]
    fn all_notes_hidden_opens_the_list() {
        // 아무것도 띄우지 않으면 앱은 켜져 있는데 화면에 아무것도 없다.
        // 창 테두리도 트레이 아이콘도 없으므로 사용자가 다시 닿을 방법이 없다.
        assert_eq!(startup_plan(1, vec![]), Startup::List);
    }

    #[test]
    fn label_is_prefixed() {
        assert_eq!(note_label("abc-123"), "note-abc-123");
    }
}
