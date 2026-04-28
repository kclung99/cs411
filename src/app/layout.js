import './globals.css'
import { DesktopNav, MobileNav } from '@/components/app-nav'

export const metadata = {
  title: 'WattWhere Reliability Dashboard',
  description: 'Station reliability operations dashboard for EV charging operators',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-muted/40">
        <div className="min-h-screen md:pl-64">
          <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background md:flex md:flex-col">
            <div className="border-b px-5 py-4">
              <h1 className="text-lg font-semibold">WattWhere</h1>
              <p className="text-xs text-muted-foreground">Reliability Console</p>
            </div>
            <DesktopNav />
          </aside>

          <header className="border-b bg-background px-3 py-3 md:hidden">
            <MobileNav />
          </header>

          {children}
        </div>
      </body>
    </html>
  )
}
