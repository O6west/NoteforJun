pub mod commands;
pub mod html;
pub mod note;
pub mod storage;
pub mod windows;

use tauri::Manager;

use crate::commands::AppPaths;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let base = app
                .path()
                .data_dir()
                .expect("데이터 폴더를 찾을 수 없습니다")
                .join("NoteforJun");
            let notes = storage::notes_dir(&base);
            std::fs::create_dir_all(&notes)?;

            // 순서가 중요하다. restore_all이 만드는 메모 창은 뜨자마자
            // load_note를 부르는데, 그때 AppPaths가 등록돼 있어야 한다.
            app.manage(AppPaths { notes: notes.clone() });
            windows::restore_all(app.handle(), &notes)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_notes,
            commands::load_note,
            commands::save_note,
            commands::create_note,
            commands::delete_note,
            commands::open_note_window,
            commands::hide_note_window,
            commands::open_list_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteforJun");
}
