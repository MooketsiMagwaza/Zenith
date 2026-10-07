import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/dm-sans/200.css'
import '@fontsource/dm-sans/300.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import { installBridge } from './bridge'
import './shared/styles.css'

async function start() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root not found')
  await installBridge()
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

start().catch((err) => {
  document.body.innerHTML = `
    <div style="padding:20px;color:#ece9e3;background:#1a0000;font-family:monospace">
      <strong>Zenith could not start</strong><br/>
      <pre>${err instanceof Error ? err.message : String(err)}</pre>
    </div>
  `
})
