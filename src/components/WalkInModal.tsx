'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/money';
import { formatPhoneDisplay, isValidIndianMobile, normalizePhoneIN } from '@/lib/phone';
import { lookupBusinessCustomerByPhone } from '@/lib/actions/customers';
import { createWalkIn } from '@/lib/actions/walkin';
import { DomainError, FRIENDLY_MESSAGES } from '@/lib/errors';

type ServiceOption = { id: string; name: string; price_paise: number; duration_minutes: number };
type ProfessionalOption = { id: string; full_name: string; serviceIds: string[] };

type FoundCustomer = {
  id: string;
  full_name: string | null;
  gender: string | null;
  profile_completed_at: string | null;
} | null;

export function WalkInModal({
  businessId,
  branchId,
  services,
  professionals,
  onClose,
}: {
  businessId: string;
  branchId: string;
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'confirm-customer' | 'service' | 'submitting'>('phone');
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<FoundCustomer>(null);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const eligibleProfessionals = useMemo(
    () => professionals.filter((p) => !serviceId || p.serviceIds.includes(serviceId)),
    [professionals, serviceId]
  );

  const normalizedPhoneDisplay = useMemo(() => {
    try {
      return formatPhoneDisplay(normalizePhoneIN(phone));
    } catch {
      return phone;
    }
  }, [phone]);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidIndianMobile(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { customer } = await lookupBusinessCustomerByPhone(businessId, phone);
      setCustomer(customer as FoundCustomer);
      setStep('confirm-customer');
    } catch (err) {
      setError(err instanceof DomainError ? FRIENDLY_MESSAGES[err.code] : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWalkIn() {
    if (!serviceId || !professionalId) {
      setError('Pick a service and a professional.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await createWalkIn({ businessId, branchId, phone, professionalId, serviceId });
      router.push(`/appointments/${result.appointment_id}`);
      onClose();
    } catch (err) {
      setError(err instanceof DomainError ? FRIENDLY_MESSAGES[err.code] : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/40 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">+ Walk-In</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <label className="label" htmlFor="walkin-phone">
              Mobile number
            </label>
            <input
              id="walkin-phone"
              className="input mb-1"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <p className="mb-4 text-xs text-ink-faint">We&apos;ll look this up against Demo Cuts&apos; customers only.</p>
            {error && <p className="mb-3 text-sm text-state-danger">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Looking up…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'confirm-customer' && (
          <div>
            {customer ? (
              <div className="mb-4 rounded-xl bg-surface-subtle p-4">
                <p className="badge mb-2 bg-brand-green-light text-brand-green-dark">Existing customer</p>
                <p className="text-base font-semibold text-ink">{customer.full_name || 'Name not set'}</p>
                <p className="text-sm text-ink-muted">{normalizedPhoneDisplay}</p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl bg-surface-subtle p-4">
                <p className="badge mb-2 bg-state-info/10 text-state-info">New customer</p>
                <p className="text-sm text-ink-muted">Phone: {normalizedPhoneDisplay}</p>
                <p className="mt-1 text-xs text-ink-faint">No name/gender/age needed yet — we&apos;ll ask before the bill.</p>
              </div>
            )}
            {error && <p className="mb-3 text-sm text-state-danger">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setStep('phone')}>
                Back
              </button>
              <button className="btn-primary flex-1" onClick={() => setStep('service')}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'service' && (
          <div>
            <label className="label">Service</label>
            <select className="input mb-4" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setProfessionalId(''); }}>
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatPaise(s.price_paise)} · {s.duration_minutes} min
                </option>
              ))}
            </select>

            <label className="label">Professional</label>
            <select className="input mb-4" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} disabled={!serviceId}>
              <option value="">{serviceId ? 'Select a professional…' : 'Pick a service first'}</option>
              {eligibleProfessionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            {serviceId && eligibleProfessionals.length === 0 && (
              <p className="mb-4 text-sm text-state-warning">No professional at this branch performs this service yet.</p>
            )}

            {error && <p className="mb-3 text-sm text-state-danger">{error}</p>}

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setStep('confirm-customer')}>
                Back
              </button>
              <button className="btn-primary flex-1" disabled={loading || !serviceId || !professionalId} onClick={handleCreateWalkIn}>
                {loading ? 'Starting…' : 'Start Visit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
