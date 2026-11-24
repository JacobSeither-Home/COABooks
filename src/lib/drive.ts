// Google Drive access with the narrow drive.file scope: the reader picks the books zip once in
// Google's own Picker, and the app can then read that one file and nothing else in their Drive.
// Sign-in goes by redirect rather than a popup, because popups misbehave in a Home Screen app.
import { GOOGLE_API_KEY, GOOGLE_APP_ID, GOOGLE_CLIENT_ID } from '../config'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN = 'coa.driveToken'
const RETURN = 'coa.driveReturn'

interface Token { value: string; expires: number }

export function driveToken(): string | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN) ?? 'null') as Token | null
    return t && t.expires > Date.now() + 60_000 ? t.value : null
  } catch { return null }
}

/** Sends the reader to Google to allow access, then back to the same screen. */
export function connectDrive(hint?: string) {
  sessionStorage.setItem(RETURN, location.hash || '#/')
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: location.origin + location.pathname,
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state: 'coa-drive',
  })
  if (hint) p.set('login_hint', hint)
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`)
}

/** On load: pick up a token Google sent back in the address (#access_token=…). Returns an error, if any. */
export function finishDriveRedirect(): string | null {
  const h = location.hash.slice(1)
  if (!/(^|&)(access_token|error)=/.test(h) || !/(^|&)state=coa-drive/.test(h)) return null
  const p = new URLSearchParams(h)
  const back = sessionStorage.getItem(RETURN) ?? '#/'
  sessionStorage.removeItem(RETURN)
  history.replaceState(null, '', location.pathname + location.search + back)
  if (p.get('error')) return p.get('error')
  const value = p.get('access_token')!
  const expires = Date.now() + Number(p.get('expires_in') ?? 3600) * 1000
  sessionStorage.setItem(TOKEN, JSON.stringify({ value, expires } satisfies Token))
  return null
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not reach Google'))
    document.head.appendChild(s)
  })
}

// Minimal typing for the parts of the Picker API used here.
interface PickerDoc { id: string; name: string; sizeBytes?: number }
interface PickerResponse { action: string; docs?: PickerDoc[] }
declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void }
    google?: { picker: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

/** Opens Google's file chooser; resolves with the chosen zip, or null if cancelled. */
export async function pickZip(token: string): Promise<PickerDoc | null> {
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise<void>((r) => window.gapi!.load('picker', r))
  const g = window.google!.picker
  return new Promise((resolve) => {
    const view = new g.DocsView(g.ViewId.DOCS)
      .setMimeTypes('application/zip,application/x-zip-compressed,application/x-zip,application/octet-stream')
      .setIncludeFolders(true)
      .setMode(g.DocsViewMode.LIST)
    const picker = new g.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_APP_ID)
      .setTitle('Choose your Project Aon books zip')
      .setCallback((r: PickerResponse) => {
        if (r.action === g.Action.PICKED && r.docs?.[0]) resolve(r.docs[0])
        else if (r.action === g.Action.CANCEL) resolve(null)
      })
      .build()
    picker.setVisible(true)
  })
}

export async function openDriveFile(token: string, id: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number; name: string }> {
  const auth = { Authorization: `Bearer ${token}` }
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,size`, { headers: auth })
  if (meta.status === 401) throw new Error('expired')
  if (!meta.ok) throw new Error(meta.status === 404 ? 'That file isn’t shared with this app any more. Choose it again.' : `Google Drive answered ${meta.status}`)
  const info = await meta.json() as { name: string; size?: string }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: auth })
  if (!res.ok || !res.body) throw new Error(`Google Drive answered ${res.status}`)
  return { stream: res.body, size: Number(info.size ?? 0), name: info.name }
}
