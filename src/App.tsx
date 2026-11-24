import { Route, Routes } from 'react-router-dom'
import Accounts from './pages/Accounts'
import BookView from './pages/BookView'
import Home from './pages/Home'
import Import from './pages/Import'
import NewCharacter from './pages/NewCharacter'
import NextBook from './pages/NextBook'
import Reader from './pages/Reader'
import { useAccount } from './lib/store'

export default function App({ notice }: { notice: string | null }) {
  const acct = useAccount()
  if (!acct) return <Accounts error={notice} />
  return (
    <>
      {notice ? <div className="notice">{notice}</div> : null}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/import" element={<Import />} />
        <Route path="/new" element={<NewCharacter />} />
        <Route path="/play/:id" element={<Reader />} />
        <Route path="/next/:id" element={<NextBook />} />
        <Route path="/book/:bookId" element={<BookView />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
