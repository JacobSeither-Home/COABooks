import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/db'

/** A book's first illustration as an <img>, or nothing while it loads. */
export function useCover(bookId: string | undefined, file: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (bookId && file) imageUrl(bookId, file).then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [bookId, file])
  return url
}

export default function BookCover({ bookId, file, title, num }: { bookId: string; file?: string; title: string; num?: string }) {
  const url = useCover(bookId, file)
  return (
    <div className="cover">
      {url ? <img src={url} alt="" /> : <div className="cover-blank" />}
      <div className="cover-shade" />
      {num ? <span className="cover-num">{num}</span> : null}
      <span className="cover-title">{title}</span>
    </div>
  )
}
