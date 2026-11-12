import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyAppearance, watchSystemTheme } from './lib/theme'
import './index.css'
import App from './App.tsx'
import { captureJoinFromLocation } from './sync/secret'

captureJoinFromLocation()

applyAppearance()
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
