import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

import './stili/token.css'
import './stili/base.css'
import './stili/editor.css'

createRoot(document.getElementById('radice')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
