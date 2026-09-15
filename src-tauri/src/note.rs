use serde::{Deserialize, Serialize};

use crate::html::strip_html;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub visible: bool,
    /// 이 메모를 다른 창 위에 고정할지. 상단바 핀으로 끄고 켠다.
    ///
    /// 기존 메모 파일에는 이 필드가 없다. 없으면 true로 읽는다 — 지금까지
    /// 늘 앞에 떠 있던 메모들이 앱을 새로 깔았다고 갑자기 뒤로 숨으면 안 된다.
    #[serde(default = "pinned_default")]
    pub pinned: bool,
}

fn pinned_default() -> bool {
    true
}

impl Default for WindowState {
    fn default() -> Self {
        Self { x: 48, y: 48, width: 460, height: 540, visible: true, pinned: true }
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
        assert_eq!((w.width, w.height), (460, 540));
        assert!(w.visible);
        assert!(w.pinned, "새 메모는 고정된 채로 시작한다");
    }

    #[test]
    fn old_files_without_pinned_load_as_pinned() {
        // 기존 메모 파일에는 pinned 필드가 없다. serde default가 없으면
        // 여기서 통째로 역직렬화가 실패하고, 그 메모는 영영 안 열린다.
        let raw = r#"{
            "id": "x",
            "title": "옛 메모",
            "content": "<p>내용</p>",
            "color": "yellow",
            "window": { "x": 1, "y": 2, "width": 460, "height": 540, "visible": true },
            "createdAt": "2026-09-01T00:00:00Z",
            "updatedAt": "2026-09-01T00:00:00Z"
        }"#;
        let note: Note = serde_json::from_str(raw).expect("옛 형식을 읽을 수 있어야 한다");
        assert!(note.window.pinned);
    }
}
