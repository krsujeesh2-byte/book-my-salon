'use client';

import { useState } from 'react';
import { WalkInModal } from './WalkInModal';

export function NewWalkInButton({
  businessId,
  branchId,
  services,
  professionals,
}: {
  businessId: string;
  branchId: string;
  services: { id: string; name: string; price_paise: number; duration_minutes: number }[];
  professionals: { id: string; full_name: string; serviceIds: string[] }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Walk-In
      </button>
      {open && (
        <WalkInModal
          businessId={businessId}
          branchId={branchId}
          services={services}
          professionals={professionals}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
