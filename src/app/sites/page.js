import SiteManagementCard from '@/components/SiteManagementCard'

export default function SitesPage() {
  return (
    <main className="dashboard-page">
      <header className="card header-card">
        <h1>Site Management</h1>
        <p>Create, read, update, and delete site records in the database.</p>
      </header>

      <SiteManagementCard />
    </main>
  )
}
