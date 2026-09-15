*English · [한국어](README.ko.md)*

<img src="src-tauri/icons/128x128@2x.png" alt="" width="88" align="left">

### NoteforJun

**A note app made for Jun**

*Just take notes. Nothing else.*

<br clear="left">

<img src="docs/images/demo.gif" alt="Typing in a NoteforJun window: '# ' turns the line into a heading, '[ ] ' turns into a checkbox, clicking a checkbox strikes the line through, and selecting text brings up a formatting popup used to highlight it." width="460">

Type `# ` and the line becomes a heading. Type `[ ] ` and it becomes a checkbox. Select text and the formatting buttons appear. Nothing to set up first.

## Download

**[⬇ Download for Windows](https://github.com/O6west/NoteforJun/releases/latest/download/NoteforJun-Setup.exe)** · 18 MB · Windows 10 or 11

1. Click the link above. Your browser downloads `NoteforJun-Setup.exe`.
2. Open it. **Windows will show a blue "Windows protected your PC" screen.**
3. Click **More info**, then **Run anyway**.
4. It installs and a note opens. That's it — nothing to sign up for.

> **Why the warning?** The installer isn't code-signed. A signing certificate
> costs money every year, and I'm a student who built this for himself. Windows
> shows that screen for anything unsigned, whether it's harmful or not.
>
> You don't have to take my word for it — every line of this app is in this
> repository, and you can build it yourself.
>
> If people actually end up using this, signing it and putting it on the
> Microsoft Store is the first thing I'd do. Then the warning goes away.

To uninstall, use Windows **Settings → Apps**. Your notes stay in
`%APPDATA%\NoteforJun` either way.


## Why I made this

I'm an ordinary university student. (from 🇰🇷)

I've installed task managers more times than I can count, and I always stalled at the same spot. Before writing anything down I had to decide **which project it belonged to, when it was due, what to tag it**. A decision wedges itself between having the thought and writing it down. Do that enough times and you stop writing things down at all.

So I kept going back to Windows Sticky Notes. It's open, you click, you type. That was the whole appeal. Eventually I was running fairly serious things out of sticky notes.

But living in it, a few things nagged.

- Once five or six notes pile up, you can't tell one from another
- I'm writing down things to do, and there are no checkboxes
- No way to highlight the line that matters
- The text is small and there's no way to make it bigger

**Wasn't there a notepad that nails the basics and stays light and clean?** I looked for a while, and then figured I'd make it.

So I built one for myself. That's all the name is — I'm Jun.

Building it for exactly one person is what kept it clean. When you don't know who'll use a thing, you hedge and put everything in. When the only user is you, there's no reason to add a feature you won't use. Every time I was tempted to add one more, I asked first: *would this drag it back toward the reason I left task managers in the first place?*

What came out is Sticky Notes with those four things filled in and **nothing else added**. I made it for me — but if you got stuck in the same place I did, it'll probably fit you too.


## Three principles

### 1. Removing choices *is* the feature

Sticky Notes survived not because it has few features, but because there is **nothing to decide**. The font, the text size, the spacing, the alignment — nailing those down in advance is the core feature of this app, not a limitation of it.

**There is no settings screen.** What you can choose: one of six note colors, the window size and position, whether a note stays on top, and whether the app starts with Windows. That's the whole list. All four live in the `⋯` menu or on the title bar. There is no settings page to go into.

### 2. If you'd have to learn something that only works here, it doesn't go in

`Ctrl+B` has meant the same thing in every program for decades. You already know it, so there is nothing to learn. A shortcut or syntax invented for this app alone would cost you something to learn, so it stays out.

### 3. Discoverable, never required

Type `#` and the text gets bigger. Never knowing that costs you nothing. Select text and formatting buttons appear. Never using them costs you nothing either. Every extra is built so that you **can use the app without knowing it, and come out ahead if you stumble onto it**.


## How to use it

Write. That's the whole thing.

The first time you open the app, one note is already waiting. That note *is* the manual — by the time you've read it, you've seen everything the app does. Delete it when you're done and it won't come back.

When you want more, hover the `?` on the title bar.

| Type this | Get this |
|---|---|
| `[ ]` + space | ☐ a to-do |
| `#` + space | a heading |
| `Ctrl+B` `I` `U` | bold / italic / underline |
| select text | formatting popup, highlighter included |
| `Ctrl+Alt+N` | a new note, from anywhere |

A few other things worth knowing.

- **Autosave** — there is no save button. What you write is saved on its own, and a small `✓` blinks when it lands. Color and position changes are saved too, but quietly — you can already see those happened.
- **📌 Pin** — pinning keeps that one note above other windows. Pin only what you want to keep in sight; each note remembers its own setting.
- **`×` puts a note away, it does not delete it** — closed notes stay in the list. Deleting happens in the list window, and only there. There is exactly one way to delete a note.
- **After a restart**, up to five notes you were last working in come back. Notes with an empty body are skipped.
- **When notes pile up**, `⋯ → All notes` gives you color stripes, previews, and search.


## Left out on purpose

This list describes the app better than the feature list does.

| Not here | Why |
|---|---|
| Reminders / notifications | The textbook example of a feature you learn and then quit over |
| Cloud sync | This is a tool for one person. The moment it needs a server, it becomes a different thing |
| Tags / folders / sorting | Forcing you to file things is what stops it being a sticky note |
| Dark mode / themes | Directly against the principle of removing choices |
| Pasting images | Note sizes start jumping around |
| `##` and deeper headings | If a note needs document structure, it's time for a different tool |
| Export | The saved files are already human-readable, sitting in a folder |
| A settings screen | This entire list exists so that there doesn't have to be one |


## Where your notes live

Under `%APPDATA%\NoteforJun\notes\` — one JSON file per note.

Nothing is uploaded. No account, no login. Uninstalling the app leaves the folder alone, and you can open any note in a text editor and read it.


## Built with

| | |
|---|---|
| Shell | [Tauri v2](https://tauri.app) (Rust) — uses the WebView already on Windows, so no runtime ships with it |
| Editor | [TipTap](https://tiptap.dev) / ProseMirror — one of the few that handles CJK composition input properly |
| Build | Vite |
| Tests | Vitest (UI) + `cargo test` (windows, storage) |

```bash
npm install
npm run tauri dev     # run while developing
npm run tauri build   # produce the installer

npm test                                        # UI tests
cargo test --manifest-path src-tauri/Cargo.toml # window and storage tests
```

### Language

The app follows your OS language: Korean on a Korean system, English everywhere else. There is no language picker — people want to work in the language their computer is already set to, and asking again would be asking a question that's already been answered.


## Design notes

This app was built leaving the reasoning behind each decision in writing. They record **why it was built this way, and what was decided against** — which matters more here than what was built.

The documents are in Korean.

- [Design document](docs/superpowers/specs/2026-09-11-noteforjun-design.md) — the problem, the principles, the screens
- [Usability pass](docs/superpowers/specs/2026-09-13-noteforjun-usability-design.md) — what changed after living with v1, and why

Code comments follow the same rule: not *what* this does, but *why* it is this way.


## If it sticks

I built this for myself and it's free — no account, no ads, nothing to buy.

If you end up actually keeping your notes in it, a coffee is welcome —
[buymeacoffee.com/noteforjun](https://buymeacoffee.com/noteforjun), or the
**Sponsor** button at the top of this page if you'd rather stay on GitHub.
Not paying anything changes nothing: the app has no paid tier and never will.

Bug reports and "this annoyed me" notes are worth more than coffee, honestly.
[Open an issue](https://github.com/O6west/NoteforJun/issues).

## License

[MIT](LICENSE) © 2026 Jun Oh

## Releasing

Update artifacts are signed. Without the key the build stops, and without the
signature the manifest script stops — a silent no-op update is the one failure
mode nobody notices.

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.noteforjun/updater.key)"
npm run tauri build
npm run release:manifest     # writes latest.json from the .sig
gh release create vX.Y.Z \
  src-tauri/target/release/bundle/nsis/*-setup.exe \
  src-tauri/target/release/bundle/latest.json
```

`latest.json` must be attached to the release — the app checks
`releases/latest/download/latest.json` and updates silently do nothing without it.
