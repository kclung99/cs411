import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'WattWhere Dashboard',
  description: 'View EV charging history and recommendation records by user',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="top-nav">
          <div className="top-nav-inner">
            <Link href="/">Dashboard</Link>
            <Link href="/sites">Site CRUD</Link>
            <Link href="/search">Search</Link>
            <Link href="/advanced">Advanced DB</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
