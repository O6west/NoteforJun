use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};
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
