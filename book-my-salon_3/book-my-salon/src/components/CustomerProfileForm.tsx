'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeCustomerProfile } from '@/lib/actions/customers';
import { DomainError, FRIENDLY_MESSAGES } from '@/lib/errors';

/**
 * First-time customer profile completion — spec section 18. Shown once,
 * right before the first invoice can be generated; never asked again once
 * business_customers.profile_completed_at is set.
 */
export function CustomerProfileForm({ customerId, phone }: { customerId: string; phone: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'undisclosed'>('undisclosed');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await completeCustomerProfile({
        customerId,
        fullName: fullName.trim(),
        gender,
        age: age ? Number(age) : null,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof DomainError ? FRIENDLY_MESSAGES[err.code] : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <p className="badge mb-3 bg-state-info/10 text-state-info">First visit</p>
      <h3 className="mb-1 text-sm font-semibold text-ink">Quick profile before the bill</h3>
      <p className="mb-4 text-sm text-ink-muted">
        {phone} — we only ask this once. Future visits skip straight to billing.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Gender</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
            <option value="undisclosed">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Age</label>
          <input className="input" type="number" min={1} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-state-danger">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary mt-4">
        {loading ? 'Saving…' : 'Save & Continue'}
      </button>
    </form>
  );
}
