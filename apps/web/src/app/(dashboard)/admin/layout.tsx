import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

// TODO: Import auth utilities once implemented
// import { getUser } from '@/lib/auth'
// import { isAdminUser } from '@/lib/permissions'

interface AdminLayoutProps {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // TODO: Implement authentication and authorization check
  // const user = await getUser()
  
  // if (!user) {
  //   redirect('/login')
  // }
  
  // if (!isAdminUser(user)) {
  //   redirect('/dashboard')
  // }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-background">
        <nav className="flex flex-col gap-2 p-4">
          <h2 className="mb-4 text-lg font-semibold">Admin Panel</h2>
          <a href="/admin/overview" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Overview
          </a>
          <a href="/admin/users" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Users
          </a>
          <a href="/admin/workspaces" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Workspaces
          </a>
          <a href="/admin/analytics" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Analytics
          </a>
          <a href="/admin/billing" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Billing
          </a>
          <a href="/admin/settings" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            Settings
          </a>
        </nav>
      </aside>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}