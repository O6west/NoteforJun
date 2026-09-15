//! Rust 쪽에서 사용자에게 보이는 문구. OS 언어에 따라 고른다.
//!
//! 화면 쪽 문구는 `src/lib/i18n.js`가 맡는다. 여기 있는 것은 웹뷰가 뜨기 전에
//! 정해져야 하는 것들뿐이다 — 작업표시줄에 뜨는 창 제목과, 처음 켰을 때
//! 내미는 안내 메모.

/// OS 언어가 한국어인가.
///
/// 언어를 못 읽으면 영어로 간다. 못 읽는 환경에서 한국어를 내밀면 아예 읽지
/// 못하는 사람이 생기지만, 영어를 내밀면 최소한 짐작은 된다.
pub fn is_korean() -> bool {
    sys_locale::get_locale()
        .map(|l| l.to_lowercase().starts_with("ko"))
        .unwrap_or(false)
}

/// 화면 쪽에 넘길 언어 코드.
///
/// 언어 판단은 이 파일 한 곳에서만 한다. 전에는 화면이 navigator.language를,
/// Rust가 OS 로케일을 각각 읽었다. 윈도우에는 표시 언어와 지역 형식이 따로
/// 있어서, 둘을 다르게 맞춰둔 사람에게는 화면은 영어인데 안내 메모만 한국어로
/// 뜰 수 있었다. 한 사실을 두 곳에서 판단하면 언젠가 어긋난다.
///
/// 창을 만들 때 주소에 실어 보낸다 — 메모 id를 넘기는 것과 같은 방식이다.
pub fn lang_code() -> &'static str {
    lang_code_in(is_korean())
}

/// 목록 창 제목. 작업표시줄과 창 목록에 뜬다.
pub fn list_window_title() -> &'static str {
    list_window_title_in(is_korean())
}

/// 처음 켰을 때 내미는 안내 메모의 제목.
pub fn welcome_title() -> &'static str {
    welcome_title_in(is_korean())
}

/// 처음 켰을 때 내미는 안내 메모의 본문.
///
/// 이 앱에는 설명서도 첫 실행 안내 화면도 없다. 그 자리를 이 메모가 대신한다 —
/// 읽다 보면 제목·큰 글씨·체크박스·형광펜을 이미 다 본 셈이 된다.
/// 안내가 메모 안에 들어 있으므로, 다 읽었으면 지우면 그만이다.
pub fn welcome_body() -> &'static str {
    welcome_body_in(is_korean())
}

// 아래 세 함수는 언어를 인자로 받는다. 그래야 테스트가 두 갈래를 다 볼 수 있다 —
// is_korean()에 기대면 테스트가 돌리는 컴퓨터의 언어에 따라 달라진다.

fn lang_code_in(korean: bool) -> &'static str {
    if korean {
        "ko"
    } else {
        "en"
    }
}

fn list_window_title_in(korean: bool) -> &'static str {
    if korean {
        "모든 메모"
    } else {
        "All notes"
    }
}

fn welcome_title_in(korean: bool) -> &'static str {
    if korean {
        "제목 입력도 가능"
    } else {
        "You can title it too"
    }
}

fn welcome_body_in(korean: bool) -> &'static str {
    if korean {
        concat!(
            "<h1>내가 쓸 때 편하라고 만든 앱. NoteforJun</h1>",
            "<ul data-type=\"taskList\"><li data-checked=\"false\"><p>이런 것도 됩니다</p></li></ul>",
            "<p><mark>이런 것도 가능하구요!</mark></p>",
            "<p></p>",
            "<p><strong>편하게 메모하세요. 다른 건 없습니다.</strong></p>",
            "<p></p>",
            "<p><strong>Made by Jun Oh</strong></p>",
        )
    } else {
        concat!(
            "<h1>Made so writing feels easy. NoteforJun</h1>",
            "<ul data-type=\"taskList\"><li data-checked=\"false\"><p>Checkboxes work</p></li></ul>",
            "<p><mark>So does highlighting!</mark></p>",
            "<p></p>",
            "<p><strong>Just take notes. Nothing else.</strong></p>",
            "<p></p>",
            "<p><strong>Made by Jun Oh</strong></p>",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn has_hangul(s: &str) -> bool {
        s.chars().any(|c| ('가'..='힣').contains(&c))
    }

    /// 두 언어의 안내 메모가 같은 것을 보여주는지 확인한다.
    ///
    /// 한쪽에서 뭔가 빠지면 그 언어 사용자는 그 기능이 있는 줄도 모르고 지나간다.
    /// 번역하다 줄 하나를 흘리는 것은 흔한 일이고, 눈으로는 잘 안 보인다.
    #[test]
    fn both_welcome_notes_show_the_same_things() {
        for korean in [true, false] {
            let body = welcome_body_in(korean);
            assert!(body.contains("<h1>"), "큰 글씨 ({korean})");
            assert!(body.contains("taskList"), "체크박스 ({korean})");
            assert!(body.contains("<mark>"), "형광펜 ({korean})");
            assert!(body.contains("<strong>"), "굵게 ({korean})");
            assert!(body.contains("Made by Jun Oh"), "만든 사람 ({korean})");
        }
    }

    /// 옮기다 만 줄을 잡는다. 한국어 컴퓨터에서 개발하면 영어 화면을 볼 일이
    /// 없어서, 이런 것은 사용자가 먼저 발견하게 된다.
    #[test]
    fn english_side_has_no_hangul() {
        assert!(!has_hangul(welcome_body_in(false)), "안내 메모 본문");
        assert!(!has_hangul(welcome_title_in(false)), "안내 메모 제목");
        assert!(!has_hangul(list_window_title_in(false)), "목록 창 제목");
    }

    #[test]
    fn korean_side_is_actually_korean() {
        assert!(has_hangul(welcome_body_in(true)));
        assert!(has_hangul(welcome_title_in(true)));
        assert!(has_hangul(list_window_title_in(true)));
    }

    /// 화면 문구는 lang_code로 고르고 안내 메모는 Rust가 고른다.
    /// 둘이 어긋나면 화면은 영어인데 첫 메모만 한국어로 뜬다.
    #[test]
    fn lang_code_matches_the_welcome_note() {
        assert_eq!(lang_code_in(true), "ko");
        assert!(has_hangul(welcome_body_in(true)));

        assert_eq!(lang_code_in(false), "en");
        assert!(!has_hangul(welcome_body_in(false)));
    }

    #[test]
    fn nothing_is_empty() {
        for korean in [true, false] {
            assert!(!welcome_title_in(korean).trim().is_empty());
            assert!(!welcome_body_in(korean).trim().is_empty());
            assert!(!list_window_title_in(korean).trim().is_empty());
        }
    }
}
