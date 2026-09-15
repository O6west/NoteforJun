import { invoke } from '@tauri-apps/api/core'

export const listNotes = () => invoke('list_notes')
export const loadNote = (id) => invoke('load_note', { id })
export const saveNote = (note) => invoke('save_note', { note })
export const createNote = () => invoke('create_note')
export const deleteNote = (id) => invoke('delete_note', { id })
export const openNoteWindow = (id) => invoke('open_note_window', { id })
export const hideNoteWindow = (id) => invoke('hide_note_window', { id })
export const openListWindow = () => invoke('open_list_window')
export const autostartEnabled = () => invoke('autostart_enabled')
export const setAutostart = (on) => invoke('set_autostart', { on })
