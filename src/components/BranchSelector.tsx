'use client';

import { useRouter } from 'next/navigation';

export function BranchSelector({
  branches,
  currentBranchId,
}: {
  branches: { id: string; name: string }[];
  currentBranchId: string | null;
}) {
  const router = useRouter();

  function onChange(branchId: string) {
    document.cookie = `bms_branch=${branchId}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  if (branches.length <= 1) {
    return <span className="text-sm font-medium text-ink">{branches[0]?.name ?? 'No branch'}</span>;
  }

  return (
    <select
      className="rounded-pill border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink focus:border-brand-green focus:outline-none"
      value={currentBranchId ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
