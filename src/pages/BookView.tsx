import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BookHtml from '../components/BookHtml'
import { useBook } from '../lib/hooks'
import { eraOf } from '../lib/rules/eras'

export default function BookView() {
  const { bookId } = useParams()
  const id = decodeURIComponent(bookId ?? '')
  const book = useBook(id)
  const nav = useNavigate()
  const [page, setPage] = useState<string | null>(null)
  if (book === undefined) return <main className="page"><p>Opening…</p></main>
  if (!book) return <main className="page"><p>That book isn’t on this device. <Link to="/import">Import</Link></p></main>
  const era = eraOf(book.id)
  if (page && book.pages[page]) {
    return (
      <main className="page narrow">
        <button className="link back" onClick={() => setPage(null)}>‹ {book.title}</button>
        <BookHtml bookId={book.id} html={book.pages[page].html} onPage={setPage} />
      </main>
    )
  }
  return (
    <main className="page narrow">
      <button className="link back" onClick={() => nav('/')}>‹ Library</button>
      <div className="eyebrow">{era.label}</div>
      <h1 className="title">{book.title}</h1>
      <p className="lede">{book.lastSection} sections · {book.abilities.length} {era.abilityLabel}</p>
      <Link className="primary block-btn" to={`/new?book=${encodeURIComponent(book.id)}`}>New adventure in this book</Link>
      <ul className="page-list">
        {book.pageOrder.map((p) => <li key={p}><button onClick={() => setPage(p)}>{book.pages[p].title}</button></li>)}
      </ul>
    </main>
  )
}
