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
    /// 본문이 비어 있는가 (제목은 보지 않는다)
    pub body_empty: bool,
    /// ISO 8601. 앞자리부터 자릿수가 고정돼 있어 문자열 비교가 곧 시간순이다.
    pub updated_at: String,
}

impl From<&Note> for Candidate {
    fn from(n: &Note) -> Self {
        Self {
            id: n.id.clone(),
            was_visible: n.window.visible,
            body_empty: is_body_empty(n),
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
/// 본문이 빈 메모를 빼는 이유는 되살려봐야 볼 것이 없어서다. 제목만 써둔
/// 메모도 여기서 빠진다 — 제목은 무엇을 적으려 했는지의 표시일 뿐이고,
/// 책상에 다시 올려둘 이유는 적어둔 내용 쪽에 있다. (지우지는 않는다.
/// 지우는 판단은 is_blank가 따로 한다.)
pub fn startup_plan(candidates: Vec<Candidate>) -> Startup {
    let mut keep: Vec<Candidate> = candidates.into_iter().filter(|c| !c.body_empty).collect();
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
        // 다른 프로그램을 클릭해도 메모는 앞에 남는다. 포스트잇으로 쓰는 앱인데
        // 뒤로 숨으면 볼 때마다 찾아와야 한다. 기본은 고정이고, 거슬리는 메모만
        // 상단바 핀으로 내린다 — 메모마다 따로 기억한다.
        .always_on_top(note.window.pinned)
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
        // 목록도 항상 위다. 메모 창만 항상 위면, 목록이 메모와 겹치는 자리에
        // 뜨는 순간 영영 뒤에 갇힌다 — 항상 위 창은 일반 창의 포커스로 넘을 수
        // 없어서 목록을 클릭해도 앞으로 나오지 못한다. 목록은 메모를 지울 수 있는
        // 유일한 화면이므로 닿지 못하면 곤란하다. 넓어서 거슬리면 × 로 닫으면 된다.
        .always_on_top(true)
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
/// 내용이 있는 메모를 최대 MAX_RESTORE개까지 되살린다 — 책상을 원래대로
/// 돌려놓는 일이다. 되살릴 게 없으면 적을 수 있는 빈 메모를 내민다.
pub fn restore_all(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    let candidates: Vec<Candidate> = notes.iter().map(Candidate::from).collect();
    apply(app, notes_dir, &notes, startup_plan(candidates))
}

/// 작업표시줄 아이콘을 눌렀을 때. 적을 수 있는 빈 메모를 내민다.
///
/// 켤 때와 달리 이미 떠 있는 메모는 따지지 않는다. 아이콘을 눌렀다는 것은
/// 무언가 적을 자리를 달라는 뜻이지, 어제 보던 것을 다시 보자는 뜻이 아니다.
pub fn open_blank(app: &AppHandle, notes_dir: &PathBuf) -> tauri::Result<()> {
    let notes = load_all(notes_dir);
    apply(app, notes_dir, &notes, blank_plan(blank_ids(&notes)))
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

/// 본문이 빈 메모. 되살릴지 판단할 때만 쓴다.
///
/// 지우는 판단(is_blank)과 일부러 나눠 두었다. 되살리는 기준은 "볼 것이
/// 있느냐"이고 지우는 기준은 "잃을 것이 없느냐"인데, 제목만 써둔 메모는
/// 그 둘 사이에 있다 — 다시 띄울 만큼은 아니지만 지워서도 안 된다.
pub fn is_body_empty(note: &Note) -> bool {
    crate::html::strip_html(&note.content).trim().is_empty()
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

    fn cand(id: &str, was_visible: bool, body_empty: bool, updated_at: &str) -> Candidate {
        Candidate {
            id: id.to_string(),
            was_visible,
            body_empty,
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
    fn body_empty_notes_are_never_restored() {
        // 제목만 써둔 메모도 여기 들어온다. 되살리는 기준은 적어둔 내용이다.
        let plan = startup_plan(vec![
            cand("title-only", true, true, "2026-09-14T09:00:00Z"),
            cand("written", false, false, "2026-09-14T08:00:00Z"),
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
    fn body_empty_ignores_the_title() {
        let mut n = crate::note::Note {
            id: "x".to_string(),
            title: "제목만".to_string(),
            content: "<p></p>".to_string(),
            color: "yellow".to_string(),
            window: crate::note::WindowState::default(),
            created_at: "2026-09-14T00:00:00Z".to_string(),
            updated_at: "2026-09-14T00:00:00Z".to_string(),
        };
        assert!(is_body_empty(&n), "제목이 있어도 본문이 비면 되살리지 않는다");
        assert!(!is_blank(&n), "그렇다고 지워도 되는 메모는 아니다");

        n.content = "<p>적어둔 것</p>".to_string();
        assert!(!is_body_empty(&n));
    }

    #[test]
    fn label_is_prefixed() {
        assert_eq!(note_label("abc-123"), "note-abc-123");
    }
}
