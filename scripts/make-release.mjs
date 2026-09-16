/**
 * 릴리스에 올릴 latest.json 을 만든다.
 *
 * 업데이터는 이 파일을 보고 "새 버전이 있는가"를 판단한다. 설치 파일만 올리고
 * 이걸 빼먹으면 업데이트가 조용히 안 된다 — 아무도 눈치채지 못하는 종류의
 * 실패라, 손으로 만들지 않고 빌드 산출물에서 뽑아낸다.
 *
 * 서명(.sig)은 TAURI_SIGNING_PRIVATE_KEY 에 키 "내용"을 담아 빌드해야 생긴다.
 * 경로를 담는 변수(_PATH)는 무시되고, 서명 없이 조용히 빌드가 끝난다.
 * 서명이 없으면 여기서 멈춘다. 서명 없는 업데이트는 설치되지 않는다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const conf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))
const version = conf.version
const repo = 'O6west/NoteforJun'

const setup = `NoteforJun_${version}_x64-setup.exe`
const sig = resolve(root, `src-tauri/target/release/bundle/nsis/${setup}.sig`)

if (!existsSync(sig)) {
  console.error(`서명 파일이 없습니다: ${sig}`)
  console.error('TAURI_SIGNING_PRIVATE_KEY 에 키 내용을 담고 npm run tauri build 를 다시 하세요.')
  process.exit(1)
}

const manifest = {
  version,
  pub_date: new Date().toISOString(),
  notes: `NoteforJun ${version}`,
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(sig, 'utf8').trim(),
      url: `https://github.com/${repo}/releases/download/v${version}/${setup}`,
    },
  },
}

const out = resolve(root, 'src-tauri/target/release/bundle/latest.json')
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`latest.json 작성: ${out}`)
console.log(`  버전 ${version}`)
console.log(`  받을 곳 ${manifest.platforms['windows-x86_64'].url}`)
