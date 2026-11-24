import { useEffect, useState } from 'react'
import type { Book } from './book/parse'
import { getBook, listBooks, onBooksChanged, type BookSummary } from './db'

export function useLibrary() {
  const [books, setBooks] = useState<BookSummary[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => listBooks().then((b) => { if (alive) setBooks(b) }).catch(() => { if (alive) setBooks([]) })
    load()
    const off = onBooksChanged(load)
    return () => { alive = false; off() }
  }, [])
  return books
}

export function useBook(id: string | undefined) {
  const [book, setBook] = useState<Book | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return
    let alive = true
    setBook(undefined)
    getBook(id).then((b) => { if (alive) setBook(b ?? null) })
    return () => { alive = false }
  }, [id])
  return book
}
