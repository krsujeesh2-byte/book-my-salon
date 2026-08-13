import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { getCurrentBusinessContext } from '@/lib/context';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentBusinessContext();

  return (
    <div className="flex h-screen bg-surface-subtle">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          businessName={ctx.business?.name ?? 'Book My Salon'}
          branches={ctx.branches}
          currentBranchId={ctx.currentBranch?.id ?? null}
          userLabel={ctx.professional?.full_name ?? ctx.user.email ?? ''}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
