import { Link } from 'react-router-dom'

export default function NavHeader({ examName }) {
  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center gap-2.5">
      <Link to="/" className="flex items-center gap-2 no-underline text-inherit hover:opacity-80 transition-opacity">
        <span className="text-xl">😴</span>
        <span className="font-bold text-base text-foreground">Sleepy Study Guide</span>
      </Link>
      {examName && (
        <>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="font-medium text-sm text-muted-foreground">{examName}</span>
        </>
      )}
    </header>
  )
}
