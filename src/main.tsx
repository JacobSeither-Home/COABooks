import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { finishRedirectSignIn } from './lib/accounts'
import { finishDriveRedirect } from './lib/drive'

// Both run before the router reads the address: Google may have sent us back with a sign-in code
// (?code=) or a Drive token (#access_token=).
const driveError = finishDriveRedirect()
finishRedirectSignIn().then((signInError) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App notice={signInError ?? (driveError ? `Google Drive: ${driveError}` : null)} />
      </HashRouter>
    </StrictMode>,
  )
})

// Put the app on the device so it opens with no signal.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
