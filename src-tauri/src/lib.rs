pub mod commands;
pub mod html;
pub mod note;
pub mod storage;
pub mod windows;

use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::commands::AppPaths;

pub fn run() {
    tauri::Builder::default()
        // 두 번째 실행은 새 앱을 띄우지 않고, 적을 수 있는 빈 메모를 내민다.
        // 아이콘을 눌렀다는 것은 무언가 적을 자리를 달라는 뜻이지
        // 어제 보던 것을 다시 보자는 뜻이 아니다. 목록은 메모 창의 ⋯ 메뉴에서 연다.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let notes = {
                let paths = app.state::<AppPaths>();
                paths.notes.clone()
            };
            let _ = windows::open_blank(app, &notes);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let base = app
                .path()
                .data_dir()
                .expect("데이터 폴더를 찾을 수 없습니다")
                .join("NoteforJun");
            let notes = storage::notes_dir(&base);
            std::fs::create_dir_all(&notes)?;

            // 순서가 중요하다. restore_all이 만드는 메모 창은 뜨자마자 load_note를
            // 부르는데, 그때 AppPaths가 Tauri 상태에 등록돼 있어야 한다.
            app.manage(AppPaths { notes: notes.clone() });

            // 단축키 등록 실패로 앱을 못 켜게 하면 안 된다. Ctrl+Alt+N을 다른
            // 프로그램이 이미 쓰고 있으면 등록은 흔히 실패하는데, 그건 편의 기능
            // 하나가 빠지는 일일 뿐이다. 이 앱은 창 테두리도 트레이 아이콘도 없어서
            // 안 켜지면 사용자가 손쓸 방법이 아예 없다.
            if let Err(err) = register_shortcut(app.handle()) {
                eprintln!("전역 단축키를 등록하지 못했습니다 (다른 프로그램이 쓰는 중일 수 있습니다): {err}");
            }
            enable_autostart(app.handle());

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

fn register_shortcut(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
    let handle = app.clone();
    app.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, sc, event| {
                if sc == &hotkey && event.state() == ShortcutState::Pressed {
                    let _ = commands::create_note_with(&handle);
                }
            })
            .build(),
    )?;
    app.global_shortcut().register(hotkey)?;
    Ok(())
}

fn enable_autostart(app: &tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if manager.is_enabled().unwrap_or(false) {
        return;
    }
    // 설정 화면이 없으므로 설치 즉시 켠다. 끄고 싶으면 윈도우 시작 프로그램에서 끈다.
    let _ = manager.enable();
}
