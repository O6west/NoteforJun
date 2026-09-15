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
            // 창 만들기는 반드시 별도 스레드에서. Tauri 문서가 명시하듯 윈도우에서
            // 이벤트 핸들러 안에서 창을 만들면 교착한다 — 앱 전체가 멈춘다.
            let app = app.clone();
            std::thread::spawn(move || {
                let notes = {
                    let paths = app.state::<AppPaths>();
                    paths.notes.clone()
                };
                let _ = windows::open_blank(&app, &notes);
            });
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
            init_autostart(app.handle(), &base);

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
            commands::autostart_enabled,
            commands::set_autostart,
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
                    // 여기도 이벤트 핸들러다. 창 만들기를 여기서 바로 하면 교착한다.
                    let handle = handle.clone();
                    std::thread::spawn(move || {
                        let _ = commands::create_note_with(&handle);
                    });
                }
            })
            .build(),
    )?;
    app.global_shortcut().register(hotkey)?;
    Ok(())
}

/// 자동 시작은 처음 켤 때 한 번만 켠다.
///
/// 전에는 켤 때마다 꺼져 있는지 확인하고 꺼져 있으면 다시 켰다. 그래서 윈도우
/// 시작 프로그램에서 꺼도 다음 실행에 되살아났다 — 앱이 사용자의 결정을
/// 되돌리는 셈이다. 남의 컴퓨터에 깔릴 것을 생각하면 그대로 둘 수 없다.
///
/// 표시 파일을 하나 남겨 두 번째부터는 손대지 않는다. 켜고 끄는 것은
/// ⋯ 메뉴에서 한다. 처음에 켜 두는 것은, 켜 두지 않으면 재부팅한 뒤
/// 메모가 사라진 것처럼 보이기 때문이다.
fn init_autostart(app: &tauri::AppHandle, base: &std::path::Path) {
    use tauri_plugin_autostart::ManagerExt;

    let marker = base.join("autostart-set");
    if marker.exists() {
        return;
    }
    let _ = app.autolaunch().enable();
    // 표시 파일을 못 쓰면 다음에 또 켜게 된다. 그래도 앱은 켜져야 한다.
    let _ = std::fs::write(&marker, "");
}
