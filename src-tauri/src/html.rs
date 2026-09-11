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
