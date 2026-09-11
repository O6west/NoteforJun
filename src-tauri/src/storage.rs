use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::note::{Note, NoteSummary};

/// 앱 데이터 폴더 아래의 메모 폴더 경로.
pub fn notes_dir(base: &Path) -> PathBuf {
    base.join("notes")
}

/// 임시 파일에 먼저 쓰고 이름을 바꾼다. 쓰기 도중 전원이 끊겨도
/// 반쯤 쓰인 파일이 남지 않는다.
pub fn save(dir: &Path, note: &Note) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(note).map_err(io::Error::other)?;
    let tmp = dir.join(format!("{}.json.tmp", note.id));
    let dest = dir.join(format!("{}.json", note.id));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &dest)
}

pub fn load(dir: &Path, id: &str) -> io::Result<Note> {
    let raw = fs::read_to_string(dir.join(format!("{id}.json")))?;
    serde_json::from_str(&raw).map_err(io::Error::other)
}

pub fn delete(dir: &Path, id: &str) -> io::Result<()> {
    let path = dir.join(format!("{id}.json"));
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

/// 최근 수정순으로 정렬한 요약 목록.
/// 읽거나 파싱할 수 없는 파일은 건너뛴다 — 메모 하나가 깨져도 나머지는 열려야 한다.
pub fn list(dir: &Path) -> io::Result<Vec<NoteSummary>> {
    let mut out = Vec::new();
    if !dir.exists() {
        return Ok(out);
    }
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
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
}
