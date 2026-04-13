import './globals.css'

export const metadata = {
  title: 'WattWhere Dashboard',
  description: 'View EV charging history and recommendation records by user',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
