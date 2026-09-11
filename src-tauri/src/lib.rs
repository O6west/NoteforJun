pub mod html;
pub mod note;
pub mod storage;

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running NoteforJun");
}
