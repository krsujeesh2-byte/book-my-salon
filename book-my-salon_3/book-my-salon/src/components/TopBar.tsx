import { BranchSelector } from './BranchSelector';
import { SignOutButton } from './SignOutButton';

export function TopBar({
  businessName,
  branches,
  currentBranchId,
  userLabel,
}: {
  businessName: string;
  branches: { id: string; name: string }[];
  currentBranchId: string | null;
  userLabel: string;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-surface-border bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">{businessName}</span>
        <span className="text-ink-faint">·</span>
        <BranchSelector branches={branches} currentBranchId={currentBranchId} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-ink-muted">{userLabel}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
