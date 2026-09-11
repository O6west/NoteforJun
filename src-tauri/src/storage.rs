use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::note::{Note, NoteSummary};

/// 메모 id는 그대로 파일 이름이 된다. 지금은 앱이 만든 UUID뿐이지만
/// 다음 태스크부터는 화면 쪽에서 넘어오므로, 폴더를 벗어날 수 있는 값을 막는다.
fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn reject_unsafe_id(id: &str) -> io::Result<()> {
    if is_safe_id(id) {
        Ok(())
    } else {
        Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("잘못된 메모 id: {id}"),
        ))
    }
}

/// 앱 데이터 폴더 아래의 메모 폴더 경로.
pub fn notes_dir(base: &Path) -> PathBuf {
    base.join("notes")
}

/// 임시 파일에 먼저 쓰고 이름을 바꾼다. 쓰기 도중 전원이 끊겨도
/// 반쯤 쓰인 파일이 남지 않는다.
pub fn save(dir: &Path, note: &Note) -> io::Result<()> {
    reject_unsafe_id(&note.id)?;
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(note).map_err(io::Error::other)?;
    // 저장이 겹쳐도 서로 다른 임시 파일을 쓰도록 매번 새 이름을 만든다.
    // 같은 이름을 쓰면 두 저장의 바이트가 섞인 채 본 파일이 될 수 있다.
    let tmp = dir.join(format!("{}.{}.json.tmp", note.id, Uuid::new_v4()));
    let dest = dir.join(format!("{}.json", note.id));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &dest)
}

pub fn load(dir: &Path, id: &str) -> io::Result<Note> {
    reject_unsafe_id(id)?;
    let raw = fs::read_to_string(dir.join(format!("{id}.json")))?;
    serde_json::from_str(&raw).map_err(io::Error::other)
}

pub fn delete(dir: &Path, id: &str) -> io::Result<()> {
    reject_unsafe_id(id)?;
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
        let Ok(entry) = entry else { continue };
        let path = entry.path();
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

    #[test]
    fn concurrent_saves_never_corrupt_the_file() {
        let dir = temp_dir("concurrent");
        let mut handles = Vec::new();
        for i in 0..8 {
            let d = dir.clone();
            handles.push(std::thread::spawn(move || {
                for _ in 0..20 {
                    let mut n = note("aaa", "2026-09-11T10:00:00Z");
                    n.title = format!("제목 {i}");
                    save(&d, &n).unwrap();
                }
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        let loaded = load(&dir, "aaa").expect("동시 저장 후에도 파일은 읽을 수 있어야 한다");
        assert!(loaded.title.starts_with("제목 "));
    }

    #[test]
    fn rejects_ids_that_escape_the_notes_folder() {
        let dir = temp_dir("unsafe-id");
        assert!(load(&dir, "../secret").is_err());
        assert!(delete(&dir, "..\\secret").is_err());
        assert!(load(&dir, "sub/dir").is_err());

        let mut n = note("../escape", "2026-09-11T10:00:00Z");
        n.title = "탈출".to_string();
        assert!(save(&dir, &n).is_err());
    }

    #[test]
    fn accepts_uuid_shaped_ids() {
        let dir = temp_dir("safe-id");
        let n = note("3f2504e0-4f89-41d3-9a0c-0305e82c3301", "2026-09-11T10:00:00Z");
        save(&dir, &n).unwrap();
        assert_eq!(load(&dir, &n.id).unwrap().id, n.id);
    }
}
