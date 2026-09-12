import 'pretendard/dist/web/static/pretendard.css'
import './styles/tokens.css'
import './styles/note.css'

import { installResizeZones } from './lib/resize.js'

installResizeZones()

document.getElementById('editor').textContent = '여기에 메모…'
