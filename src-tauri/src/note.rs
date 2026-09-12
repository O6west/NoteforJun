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
        Self { x: 48, y: 48, width: 380, height: 420, visible: true }
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
        assert_eq!((w.width, w.height), (380, 420));
        assert!(w.visible);
    }
}
