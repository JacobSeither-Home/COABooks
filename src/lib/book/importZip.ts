// Reads a Project Aon zip as a stream, one book at a time: the files of each book are gathered,
// parsed, and saved, then dropped from memory before the next book. Nothing leaves the device.
import { Unzip, UnzipInflate } from 'fflate'
import { parseBook } from './parse'
import { saveBook } from '../db'

export interface ImportProgress { bytes: number; total: number; books: string[]; current?: string }

const BOOK_PATH = /(?:^|\/)(lw|gs|fw)\/([0-9a-z]+)\/([^/]+)$/i

export async function importZip(
  stream: ReadableStream<Uint8Array>, total: number, onProgress: (p: ImportProgress) => void,
): Promise<string[]> {
  const parser = new DOMParser()
  const parseHtml = (s: string) => parser.parseFromString(s, 'text/html')
  const decoder = new TextDecoder('utf-8')
  const saved: string[] = []
  let current: { id: string; htm: Map<string, string>; png: Map<string, Uint8Array> } | null = null
  const pendingFiles: Promise<void>[] = []
  let queue: Promise<void> = Promise.resolve()
  let bytes = 0
  let failure: unknown = null

  const finish = (book: NonNullable<typeof current>) => {
    queue = queue.then(async () => {
      if (!book.htm.size) return
      onProgress({ bytes, total, books: saved, current: book.id })
      await new Promise((r) => setTimeout(r, 0)) // let the screen update
      const parsed = parseBook(book.id, book.htm, parseHtml)
      const images = new Map<string, Blob>()
      for (const name of parsed.images) {
        const data = book.png.get(name)
        if (data) images.set(name, new Blob([data as BlobPart], { type: 'image/png' }))
      }
      await saveBook(parsed, images)
      saved.push(parsed.id)
      onProgress({ bytes, total, books: saved })
    }).catch((e) => { failure ??= e })
  }

  const unzip = new Unzip((file) => {
    const m = BOOK_PATH.exec(file.name)
    if (!m) return
    const id = `${m[1].toLowerCase()}/${m[2].toLowerCase()}`
    const name = m[3]
    const isHtm = /\.htm$/i.test(name)
    const isPng = /\.png$/i.test(name) && !/^(brdr|left|right|toc|back|bckgrnd)/i.test(name)
    if (!isHtm && !isPng) return
    if (!current || current.id !== id) {
      if (current) finish(current)
      current = { id, htm: new Map(), png: new Map() }
    }
    const book = current
    const parts: Uint8Array[] = []
    pendingFiles.push(new Promise((resolve) => {
      file.ondata = (err, chunk, final) => {
        if (err) { failure ??= err; resolve(); return }
        parts.push(chunk)
        if (!final) return
        const len = parts.reduce((n, p) => n + p.length, 0)
        const all = new Uint8Array(len)
        let o = 0
        for (const p of parts) { all.set(p, o); o += p.length }
        if (isHtm) book.htm.set(name, decoder.decode(all))
        else book.png.set(name, all)
        resolve()
      }
    }))
    file.start()
  })
  unzip.register(UnzipInflate)

  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (failure) throw failure
    if (done) break
    bytes += value.length
    unzip.push(value)
    onProgress({ bytes, total, books: saved })
    // Hold the download while earlier books are still being parsed, so memory stays bounded.
    await queue
  }
  unzip.push(new Uint8Array(0), true)
  await Promise.all(pendingFiles)
  if (current) finish(current)
  await queue
  if (failure) throw failure
  if (!saved.length) throw new Error('No Project Aon books were found in that file.')
  return saved
}
