//! 작업표시줄 아이콘을 오른쪽 클릭했을 때 뜨는 '새 메모'.
//!
//! 이 목록을 윈도우는 점프 목록(Jump List)이라고 부른다. Tauri에 감싸 둔 API가
//! 없어 COM을 직접 부른다. 항목은 하나뿐이다 — 이 앱에서 아이콘을 누르는 일은
//! 언제나 "적을 자리를 달라"는 뜻이었고, 오른쪽 클릭도 같은 뜻이어야 한다.
//!
//! 항목을 누르면 앱이 `--new` 인자를 달고 다시 실행된다. 이미 켜져 있으면
//! single-instance 플러그인이 그 실행을 가로채 빈 메모를 내밀고, 꺼져 있으면
//! 앱이 뜨면서 같은 일을 한다.
//!
//! 이 파일은 윈도우에서만 쓰인다(`lib.rs`의 `#[cfg(windows)]`). 크레이트 안에
//! `windows` 모듈이 따로 있어서, 바깥 크레이트를 가리킬 때는 `::windows`로
//! 앞에 콜론 두 개를 붙인다. 안 붙이면 어느 쪽인지 몰라 컴파일이 멈춘다.

use ::windows::core::{Interface, HSTRING, PWSTR};
use ::windows::Win32::Foundation::E_OUTOFMEMORY;
use ::windows::Win32::Storage::EnhancedStorage::PKEY_Title;
use ::windows::Win32::System::Com::StructuredStorage::{PropVariantClear, PROPVARIANT};
use ::windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemAlloc, CoUninitialize, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED,
};
use ::windows::Win32::System::Variant::VT_LPWSTR;
use ::windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
use ::windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
use ::windows::Win32::UI::Shell::{
    DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink,
};

/// 이 인자를 달고 실행하면 빈 메모가 하나 뜬다.
pub const NEW_NOTE_ARG: &str = "--new";

/// 점프 목록을 등록한다. 앱을 켤 때 한 번 부른다.
///
/// 실패해도 앱은 그대로 간다. 오른쪽 클릭 메뉴 하나가 빠지는 일일 뿐이고,
/// 아이콘을 왼쪽 클릭하면 여전히 새 메모가 나온다.
pub fn install(label: &str) {
    let label = label.to_string();
    // 스레드를 따로 쓴다. 메인 스레드의 COM 아파트는 Tauri(wry)가 이미 잡아
    // 둔 것이라, 거기서 초기화와 해제를 한 번 더 하면 짝이 어긋난다.
    std::thread::spawn(move || unsafe {
        if CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_err() {
            eprintln!("작업표시줄 메뉴: COM을 시작하지 못했습니다");
            return;
        }
        if let Err(err) = build(&label) {
            eprintln!("작업표시줄 메뉴를 만들지 못했습니다: {err}");
        }
        CoUninitialize();
    });
}

unsafe fn build(label: &str) -> Result<(), Box<dyn std::error::Error>> {
    let exe = HSTRING::from(std::env::current_exe()?.as_os_str());

    let list: ICustomDestinationList =
        CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)?;

    // BeginList를 먼저 불러야 목록을 고칠 수 있다. 돌려주는 것은 사용자가
    // 직접 지운 항목들인데, 우리는 항목이 하나뿐이라 볼 것이 없다.
    let mut slots = 0u32;
    let _removed: IObjectArray = list.BeginList(&mut slots)?;

    let tasks: IObjectCollection =
        CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)?;
    tasks.AddObject(&new_note_link(&exe, label)?)?;

    list.AddUserTasks(&tasks.cast::<IObjectArray>()?)?;
    list.CommitList()?;
    Ok(())
}

unsafe fn new_note_link(exe: &HSTRING, label: &str) -> ::windows::core::Result<IShellLinkW> {
    let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
    link.SetPath(exe)?;
    link.SetArguments(&HSTRING::from(NEW_NOTE_ARG))?;
    // 아이콘을 안 주면 항목 왼쪽이 빈칸으로 남는다.
    link.SetIconLocation(exe, 0)?;
    link.SetDescription(&HSTRING::from(label))?;

    // 메뉴에 보이는 글자는 여기서 정해진다. 이 값을 빼면 항목은 만들어지되
    // 이름 없이 뜬다 — 파일로 저장된 바로가기가 아니라 메모리 위의 바로가기라,
    // 윈도우가 대신 읽을 파일 이름이 없기 때문이다.
    let store: IPropertyStore = link.cast()?;
    let mut title = lpwstr(label)?;
    let set = store.SetValue(&PKEY_Title, &title).and_then(|()| store.Commit());
    PropVariantClear(&mut title)?;
    set?;

    Ok(link)
}

/// 문자열 하나를 담은 PROPVARIANT.
///
/// 문자열은 나중에 PropVariantClear가 해제하므로 반드시 CoTaskMemAlloc으로
/// 잡아야 한다. Rust가 잡은 메모리를 넘기면 해제할 때 터진다.
unsafe fn lpwstr(text: &str) -> ::windows::core::Result<PROPVARIANT> {
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let mem = CoTaskMemAlloc(std::mem::size_of_val(&wide[..])) as *mut u16;
    if mem.is_null() {
        return Err(E_OUTOFMEMORY.into());
    }
    std::ptr::copy_nonoverlapping(wide.as_ptr(), mem, wide.len());

    let mut pv = PROPVARIANT::default();
    let inner = &mut *pv.Anonymous.Anonymous;
    inner.vt = VT_LPWSTR;
    inner.Anonymous.pwszVal = PWSTR(mem);
    Ok(pv)
}
