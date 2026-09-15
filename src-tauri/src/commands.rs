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
pub fn new_note() -> Note {
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

/// 메모 폴더 경로. async 명령에서 State 인자를 피하기 위한 헬퍼다.
fn notes_dir(app: &AppHandle) -> std::path::PathBuf {
    app.state::<AppPaths>().notes.clone()
}

/// 단축키 핸들러처럼 State를 쓸 수 없는 곳에서도 부를 수 있도록 AppHandle만 받는다.
pub fn create_note_with(app: &AppHandle) -> Result<String, String> {
    let notes = {
        let paths = app.state::<AppPaths>();
        paths.notes.clone()
    };
    let mut note = new_note();

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

/// 창을 만들거나 여닫는 명령은 반드시 async 여야 한다.
///
/// Tauri 문서가 명시한다 — 윈도우에서 WebviewWindowBuilder는 **동기 명령이나
/// 이벤트 핸들러 안에서 쓰면 교착한다**. 실제로 이 앱도 + 버튼과 목록 열기를
/// 누르면 흰 창이 뜨고 앱 전체가 멈췄다. setup 안에서 만드는 창만 멀쩡했는데,
/// 거기가 문서에서 안전하다고 못박은 유일한 자리이기 때문이다.
///
/// State 대신 app.state()를 쓰는 것도 같은 이유다 — async 명령에서 State를
/// 인자로 받으려면 수명 표기가 붙고, 그 가드를 들고 다닐 이유가 없다.
#[tauri::command]
pub async fn create_note(app: AppHandle) -> Result<String, String> {
    create_note_with(&app)
}

#[tauri::command]
pub async fn delete_note(id: String, app: AppHandle) -> Result<(), String> {
    let notes = notes_dir(&app);
    windows::close_note(&app, &id).map_err(|e| e.to_string())?;
    storage::delete(&notes, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_note_window(id: String, app: AppHandle) -> Result<(), String> {
    let notes = notes_dir(&app);
    let mut note = storage::load(&notes, &id).map_err(|e| e.to_string())?;
    note.window.visible = true;
    storage::save(&notes, &note).map_err(|e| e.to_string())?;
    windows::open_note(&app, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn hide_note_window(id: String, app: AppHandle) -> Result<(), String> {
    let notes = notes_dir(&app);
    // 파일을 못 읽어도 창은 닫혀야 한다. 메모 창에는 OS 테두리가 없어서
    // × 가 안 먹으면 그 창을 없앨 방법이 아예 없다. 기록을 고치는 것은
    // 읽을 수 있을 때만 하는 부수적인 일로 둔다.
    let Ok(note) = storage::load(&notes, &id) else {
        return windows::hide_note(&app, &id).map_err(|e| e.to_string());
    };

    // 아무것도 안 쓴 메모는 닫을 때 아예 지운다. 보관할 내용이 없고, 남겨두면
    // 목록에 (빈 메모)로 계속 남는다. 메모 창에는 삭제가 없으므로 한번 생기면
    // 목록까지 가야 없앨 수 있어 더 성가시다.
    if windows::is_blank(&note) {
        windows::close_note(&app, &id).map_err(|e| e.to_string())?;
        return storage::delete(&notes, &id).map_err(|e| e.to_string());
    }

    let mut note = note;
    note.window.visible = false;
    let saved = storage::save(&notes, &note);
    windows::hide_note(&app, &id).map_err(|e| e.to_string())?;
    saved.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_list_window(app: AppHandle) -> Result<(), String> {
    windows::open_list(&app).map_err(|e| e.to_string())
}

/// 지금 윈도우 시작 프로그램에 등록돼 있는가.
///
/// 앱 안에 따로 기억해 두지 않고 매번 실제 등록 상태를 읽는다. 사용자가
/// 윈도우 설정에서 직접 껐을 수도 있는데, 그때 메뉴의 체크만 켜져 있으면
/// 그 체크가 거짓말이 된다.
#[tauri::command]
pub fn autostart_enabled(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_autostart(on: bool, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if on { manager.enable() } else { manager.disable() }.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_note_defaults_to_yellow_and_empty() {
        let n = new_note();
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
