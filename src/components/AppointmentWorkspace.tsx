'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/money';
import { formatPhoneDisplay } from '@/lib/phone';
import {
  startServiceAction,
  addAppointmentServiceAction,
  addProductToAppointmentAction,
  completeServiceAction,
} from '@/lib/actions/appointment';
import { finalizeInvoiceAction } from '@/lib/actions/invoice';
import { DomainError, FRIENDLY_MESSAGES } from '@/lib/errors';
import { CustomerProfileForm } from './CustomerProfileForm';
import { BillScreen } from './BillScreen';

type LineItem = { id: string; type: 'service' | 'product'; name: string; price_paise: number; quantity: number };
type CatalogItem = { id: string; name: string; price_paise: number };
type InvoiceData = {
  id: string;
  invoice_number: string;
  total_paise: number;
  status: string;
  items: { id: string; item_type: string; name_snapshot: string; unit_price_paise: number; quantity: number; line_total_paise: number }[];
};

export function AppointmentWorkspace({
  appointmentId,
  status,
  professionalId,
  customer,
  lineItems,
  availableServices,
  availableProducts,
  branchName,
  upi,
  invoice,
}: {
  appointmentId: string;
  status: string;
  professionalId: string | null;
  customer: { id: string; full_name: string | null; normalized_phone: string; profile_completed_at: string | null };
  lineItems: LineItem[];
  availableServices: CatalogItem[];
  availableProducts: CatalogItem[];
  branchName: string;
  upi: { upi_id: string | null; upi_payee_name: string | null; upi_enabled: boolean };
  invoice: InvoiceData | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addServiceId, setAddServiceId] = useState('');
  const [addProductId, setAddProductId] = useState('');

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof DomainError ? FRIENDLY_MESSAGES[err.code] : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const total = lineItems.reduce((sum, i) => sum + i.price_paise * i.quantity, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</p>
          <p className="text-base font-semibold text-ink">{customer.full_name || 'Name pending first bill'}</p>
          <p className="text-sm text-ink-muted">{formatPhoneDisplay(customer.normalized_phone)}</p>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Visit items</h3>
            <span className="text-sm font-semibold text-ink">{formatPaise(total)}</span>
          </div>
          <ul className="mb-4 divide-y divide-surface-border">
            {lineItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">
                  {item.name} {item.quantity > 1 && <span className="text-ink-faint">× {item.quantity}</span>}
                  <span className="ml-2 badge bg-surface-subtle text-ink-faint">{item.type}</span>
                </span>
                <span className="text-ink-muted">{formatPaise(item.price_paise * item.quantity)}</span>
              </li>
            ))}
            {lineItems.length === 0 && <li className="py-2 text-sm text-ink-faint">No items yet.</li>}
          </ul>

          {status === 'SERVICE_STARTED' && (
            <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-4 sm:grid-cols-2">
              <div className="flex gap-2">
                <select className="input" value={addServiceId} onChange={(e) => setAddServiceId(e.target.value)}>
                  <option value="">+ Add service…</option>
                  {availableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatPaise(s.price_paise)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary shrink-0"
                  disabled={!addServiceId || loading}
                  onClick={() =>
                    run(async () => {
                      await addAppointmentServiceAction(appointmentId, addServiceId, professionalId);
                      setAddServiceId('');
                    })
                  }
                >
                  Add
                </button>
              </div>
              <div className="flex gap-2">
                <select className="input" value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                  <option value="">+ Add product…</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatPaise(p.price_paise)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary shrink-0"
                  disabled={!addProductId || loading}
                  onClick={() =>
                    run(async () => {
                      await addProductToAppointmentAction(appointmentId, addProductId, 1);
                      setAddProductId('');
                    })
                  }
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-state-danger">{error}</p>}

        {(status === 'CONFIRMED' || status === 'CHECKED_IN') && (
          <button className="btn-primary" disabled={loading} onClick={() => run(() => startServiceAction(appointmentId))}>
            Start Service
          </button>
        )}

        {status === 'SERVICE_STARTED' && (
          <button className="btn-primary" disabled={loading} onClick={() => run(() => completeServiceAction(appointmentId))}>
            Complete Service
          </button>
        )}

        {status === 'SERVICE_COMPLETED' && !customer.profile_completed_at && (
          <CustomerProfileForm customerId={customer.id} phone={formatPhoneDisplay(customer.normalized_phone)} />
        )}

        {status === 'SERVICE_COMPLETED' && customer.profile_completed_at && (
          <button className="btn-primary" disabled={loading} onClick={() => run(() => finalizeInvoiceAction(appointmentId))}>
            Generate Bill
          </button>
        )}
      </div>

      <div>
        {invoice && (
          <BillScreen
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            items={invoice.items.map((i) => ({
              id: i.id,
              item_type: i.item_type,
              name_snapshot: i.name_snapshot,
              unit_price_paise: i.unit_price_paise,
              quantity: i.quantity,
              line_total_paise: i.line_total_paise,
            }))}
            totalPaise={invoice.total_paise}
            branchName={branchName}
            upiId={upi.upi_id}
            upiPayeeName={upi.upi_payee_name}
            upiEnabled={upi.upi_enabled}
            alreadyPaid={invoice.status === 'PAID'}
          />
        )}
      </div>
    </div>
  );
}
