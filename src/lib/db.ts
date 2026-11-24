// On-device storage for imported books (IndexedDB). Shared by every account on this device, so a
// second reader doesn't need their own copy of the files.
import { coverOf, type Book } from './book/parse'

const DB = 'coabooks'
let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { opening = null; reject(req.error) }
  })
  return opening
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Storage was refused'))
  })
}
function result<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
}

export async function saveBook(book: Book, images: Map<string, Blob>) {
  const db = await open()
  const tx = db.transaction(['books', 'images'], 'readwrite')
  tx.objectStore('books').put(book)
  const store = tx.objectStore('images')
  for (const [name, blob] of images) store.put(blob, `${book.id}/${name}`)
  await done(tx)
  bookCache.set(book.id, book)
  const index = readIndex() ?? []
  writeIndex([...index.filter((b) => b.id !== book.id), summary(book)])
  listeners.forEach((f) => f())
}

const INDEX = 'coa.library'
const summary = (b: Book): BookSummary => ({ id: b.id, title: b.title, order: b.order, lastSection: b.lastSection, cover: b.cover ?? coverOf(b.images) })
function readIndex(): BookSummary[] | null { try { return JSON.parse(localStorage.getItem(INDEX) ?? 'null') } catch { return null } }
function writeIndex(list: BookSummary[]) { try { localStorage.setItem(INDEX, JSON.stringify(list)) } catch { /* full */ } }

const bookCache = new Map<string, Book>()

export async function getBook(id: string): Promise<Book | undefined> {
  if (bookCache.has(id)) return bookCache.get(id)
  const db = await open()
  const b = await result(db.transaction('books').objectStore('books').get(id)) as Book | undefined
  if (b) bookCache.set(id, b)
  return b
}

export interface BookSummary { id: string; title: string; order: number; lastSection: number; cover?: string }

export async function listBooks(): Promise<BookSummary[]> {
  const cached = readIndex()
  if (cached) return [...cached].sort((a, b) => a.order - b.order)
  const db = await open()
  const out: BookSummary[] = []
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction('books').objectStore('books').openCursor()
    req.onsuccess = () => {
      const c = req.result
      if (!c) return resolve()
      const b = c.value as Book
      out.push(summary(b))
      c.continue()
    }
    req.onerror = () => reject(req.error)
  })
  writeIndex(out)
  return out.sort((a, b) => a.order - b.order)
}

/** Item pictures from the books, kept once for all of them (icons/<file>). */
export async function saveIcons(icons: Map<string, Blob>) {
  const db = await open()
  const tx = db.transaction('images', 'readwrite')
  const store = tx.objectStore('images')
  for (const [name, blob] of icons) store.put(blob, `icons/${name}`)
  await done(tx)
}

/** The first of these item pictures that's on the device. */
export async function iconUrl(files: string[]): Promise<string | null> {
  for (const f of files) { const u = await imageUrl('icons', f); if (u) return u }
  return null
}

const urlCache = new Map<string, string>()
export async function imageUrl(bookId: string, file: string): Promise<string | null> {
  const key = `${bookId}/${file}`
  if (urlCache.has(key)) return urlCache.get(key)!
  const db = await open()
  const blob = await result(db.transaction('images').objectStore('images').get(key)) as Blob | undefined
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(key, url)
  return url
}

export async function clearBooks() {
  const db = await open()
  const tx = db.transaction(['books', 'images'], 'readwrite')
  tx.objectStore('books').clear(); tx.objectStore('images').clear()
  await done(tx)
  bookCache.clear()
  writeIndex([])
  listeners.forEach((f) => f())
}

const listeners = new Set<() => void>()
export function onBooksChanged(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } }

/** Ask the browser not to clear the books when space runs low. */
export async function keepStorage() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist() } catch { /* not offered */ }
}
