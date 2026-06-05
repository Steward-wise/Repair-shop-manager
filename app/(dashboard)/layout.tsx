import { redirect } from 'next/navigation'
import { getSessionWithRole } from '@/lib/auth'
import Sidebar from '@/components/sidebar'
import BarcodeScanner from '@/components/barcode-scanner'
import ErrorBoundary from '@/components/error-boundary'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getSessionWithRole()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user.email} userRole={role} />
      {/* Global USB barcode scanner listener — renders nothing, listens on keydown */}
      <BarcodeScanner />
      {/* Main content — offset for sidebar on desktop, top bar on mobile */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
