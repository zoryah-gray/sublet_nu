'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Quarter } from '@/app/lib/mock-data';

export interface ListingFormData {
  placeType: 'entire' | 'private';
  roommates: number;
  address: string;
  neighborhood: string;
  beds: number;
  baths: number;
  price: number;
  utilitiesIncluded: boolean;
  utilitiesCost: number;
  quarters: Quarter[];
  startDate: string;
  endDate: string;
  title: string;
  description: string;
}

const EMPTY_FORM: ListingFormData = {
  placeType: 'entire',
  roommates: 0,
  address: '',
  neighborhood: '',
  beds: 1,
  baths: 1,
  price: 0,
  utilitiesIncluded: false,
  utilitiesCost: 0,
  quarters: [],
  startDate: '',
  endDate: '',
  title: '',
  description: '',
};

const BEDS_OPTIONS = [
  { label: 'Studio', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: 4 },
];

const BATHS_OPTIONS = [
  { label: '1', value: 1 },
  { label: '1.5', value: 1.5 },
  { label: '2', value: 2 },
  { label: '2.5', value: 2.5 },
  { label: '3', value: 3 },
];

const ALL_QUARTERS: Quarter[] = ['Fall', 'Winter', 'Spring', 'Summer'];

const QUARTER_COLORS: Record<Quarter, { on: string; off: string }> = {
  Fall:   { on: 'bg-amber-100 text-amber-800 border-amber-300', off: 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50' },
  Winter: { on: 'bg-sky-100 text-sky-800 border-sky-300',       off: 'bg-white text-gray-600 border-gray-200 hover:bg-sky-50' },
  Spring: { on: 'bg-green-100 text-green-800 border-green-300', off: 'bg-white text-gray-600 border-gray-200 hover:bg-green-50' },
  Summer: { on: 'bg-orange-100 text-orange-800 border-orange-300', off: 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50' },
};

const STEP_TITLES = ['The Basics', 'Pricing, Availability & Details', 'Review'];

function validateStep1(data: ListingFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.address.trim()) errors.address = 'Address is required';
  if (!data.neighborhood.trim()) errors.neighborhood = 'Neighborhood is required';
  return errors;
}

function validateStep2(data: ListingFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.price <= 0) errors.price = 'Price must be greater than 0';
  if (data.quarters.length === 0) errors.quarters = 'Select at least one quarter';
  if (!data.startDate) errors.startDate = 'Start date is required';
  if (!data.endDate) errors.endDate = 'End date is required';
  if (data.startDate && data.endDate && data.startDate >= data.endDate)
    errors.endDate = 'End date must be after start date';
  if (!data.utilitiesIncluded && data.utilitiesCost <= 0)
    errors.utilitiesCost = 'Enter estimated utilities cost';
  if (!data.title.trim()) errors.title = 'Title is required';
  if (data.title.length > 80) errors.title = 'Title must be 80 characters or fewer';
  if (!data.description.trim()) errors.description = 'Description is required';
  if (data.description.length > 1000) errors.description = 'Description must be 1000 characters or fewer';
  return errors;
}

// ─── Helper components ────────────────────────────────────────────────────────

function FieldGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="size-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-lg leading-none"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="size-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-lg leading-none"
      >
        +
      </button>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface ListingFormProps {
  mode: 'new' | 'edit';
  subletId?: string;
  initialData?: Partial<ListingFormData>;
}

export default function ListingForm({ mode, subletId: _subletId, initialData }: ListingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ListingFormData>({ ...EMPTY_FORM, ...initialData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof ListingFormData>(key: K, value: ListingFormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const toggleQuarter = (q: Quarter) => {
    set(
      'quarters',
      data.quarters.includes(q) ? data.quarters.filter((x) => x !== q) : [...data.quarters, q],
    );
  };

  const handleNext = () => {
    const errs = step === 0 ? validateStep1(data) : step === 1 ? validateStep2(data) : {};
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    setSubmitting(false);
    router.push(mode === 'new' ? '/listings?created=1' : '/listings?updated=1');
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

  const chipClass = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
      active
        ? 'bg-violet-50 border-violet-400 text-violet-800'
        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
    );

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Step indicator */}
        <div className="flex items-start">
          {STEP_TITLES.map((title, i) => (
            <div key={i} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'size-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-colors',
                    i < step
                      ? 'bg-violet-700 border-violet-700 text-white'
                      : i === step
                        ? 'border-violet-700 text-violet-700 bg-white'
                        : 'border-gray-200 text-gray-400 bg-white',
                  )}
                >
                  {i < step ? <CheckIcon className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium text-center leading-tight',
                    i === step ? 'text-violet-700' : 'text-gray-400',
                  )}
                >
                  {title}
                </span>
              </div>
              {i < STEP_TITLES.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mt-4 mx-2',
                    i < step ? 'bg-violet-700' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: The Basics ── */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">The Basics</h2>

            <FieldGroup label="Place type">
              <div className="flex gap-2">
                {(['entire', 'private'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('placeType', type)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                      data.placeType === type
                        ? 'bg-violet-50 border-violet-400 text-violet-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {type === 'entire' ? 'Entire place' : 'Private room'}
                  </button>
                ))}
              </div>
            </FieldGroup>

            {data.placeType === 'private' && (
              <FieldGroup label="Number of roommates">
                <NumberStepper
                  value={data.roommates}
                  min={1}
                  max={8}
                  onChange={(v) => set('roommates', v)}
                />
              </FieldGroup>
            )}

            <FieldGroup label="Address" error={errors.address}>
              <input
                type="text"
                placeholder="e.g. 1234 Hinman Ave, Evanston, IL"
                value={data.address}
                onChange={(e) => set('address', e.target.value)}
                className={cn(inputClass, errors.address && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
              />
            </FieldGroup>

            <FieldGroup label="Neighborhood" error={errors.neighborhood}>
              <input
                type="text"
                placeholder="e.g. Central Evanston"
                value={data.neighborhood}
                onChange={(e) => set('neighborhood', e.target.value)}
                className={cn(inputClass, errors.neighborhood && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
              />
            </FieldGroup>

            <FieldGroup label="Bedrooms">
              <div className="flex gap-2 flex-wrap">
                {BEDS_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => set('beds', opt.value)} className={chipClass(data.beds === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="Bathrooms">
              <div className="flex gap-2 flex-wrap">
                {BATHS_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => set('baths', opt.value)} className={chipClass(data.baths === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </FieldGroup>
          </div>
        )}

        {/* ── Step 2: Pricing, Availability & Details ── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Pricing, Availability & Details</h2>

            <FieldGroup label="Monthly rent (USD)" error={errors.price}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="1500"
                  value={data.price || ''}
                  onChange={(e) => set('price', Number(e.target.value))}
                  className={cn(inputClass, 'pl-7', errors.price && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
                />
              </div>
            </FieldGroup>

            <FieldGroup label="Utilities">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.utilitiesIncluded}
                  onChange={(e) => set('utilitiesIncluded', e.target.checked)}
                  className="rounded border-gray-300 text-violet-600"
                />
                <span className="text-sm text-gray-700">Utilities included in rent</span>
              </label>
              {!data.utilitiesIncluded && (
                <div className="mt-2">
                  <label className="text-xs text-gray-500 mb-1 block">Estimated monthly cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="150"
                      value={data.utilitiesCost || ''}
                      onChange={(e) => set('utilitiesCost', Number(e.target.value))}
                      className={cn(inputClass, 'pl-7', errors.utilitiesCost && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
                    />
                  </div>
                  {errors.utilitiesCost && (
                    <p className="text-xs text-red-600 mt-1">{errors.utilitiesCost}</p>
                  )}
                </div>
              )}
            </FieldGroup>

            <FieldGroup label="Available quarters" error={errors.quarters}>
              <div className="flex gap-2 flex-wrap">
                {ALL_QUARTERS.map((q) => {
                  const active = data.quarters.includes(q);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => toggleQuarter(q)}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                        active ? QUARTER_COLORS[q].on : QUARTER_COLORS[q].off,
                      )}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </FieldGroup>

            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Start date" error={errors.startDate}>
                <input
                  type="date"
                  value={data.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={cn(inputClass, errors.startDate && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
                />
              </FieldGroup>
              <FieldGroup label="End date" error={errors.endDate}>
                <input
                  type="date"
                  value={data.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={cn(inputClass, errors.endDate && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
                />
              </FieldGroup>
            </div>

            <FieldGroup label={`Title (${data.title.length}/80)`} error={errors.title}>
              <input
                type="text"
                maxLength={80}
                placeholder="e.g. Sunny 1BR Near Campus"
                value={data.title}
                onChange={(e) => set('title', e.target.value)}
                className={cn(inputClass, errors.title && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
              />
            </FieldGroup>

            <FieldGroup label={`Description (${data.description.length}/1000)`} error={errors.description}>
              <textarea
                maxLength={1000}
                rows={5}
                placeholder="Describe your space, amenities, and any house rules…"
                value={data.description}
                onChange={(e) => set('description', e.target.value)}
                className={cn(inputClass, 'resize-none', errors.description && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
              />
            </FieldGroup>

            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center bg-gray-50">
              <p className="text-sm text-gray-500 font-medium">Photos & Videos</p>
              <p className="text-xs text-gray-400 mt-1">
                Photo and video uploads will be available in a future update. If no featured image
                is selected, the first photo in your gallery will be used.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Review your listing</h2>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
              <ReviewSection title="The Basics">
                <ReviewRow
                  label="Place type"
                  value={data.placeType === 'entire' ? 'Entire place' : 'Private room'}
                />
                {data.placeType === 'private' && (
                  <ReviewRow label="Roommates" value={data.roommates} />
                )}
                <ReviewRow label="Address" value={data.address || '—'} />
                <ReviewRow label="Neighborhood" value={data.neighborhood || '—'} />
                <ReviewRow label="Bedrooms" value={data.beds === 0 ? 'Studio' : data.beds} />
                <ReviewRow label="Bathrooms" value={data.baths} />
              </ReviewSection>

              <div className="h-px bg-gray-100" />

              <ReviewSection title="Pricing & Availability">
                <ReviewRow label="Monthly rent" value={`$${data.price.toLocaleString()}/mo`} />
                <ReviewRow
                  label="Utilities"
                  value={data.utilitiesIncluded ? 'Included' : `~$${data.utilitiesCost}/mo est.`}
                />
                <ReviewRow label="Quarters" value={data.quarters.join(', ') || '—'} />
                <ReviewRow
                  label="Available"
                  value={
                    data.startDate && data.endDate
                      ? `${data.startDate} — ${data.endDate}`
                      : '—'
                  }
                />
              </ReviewSection>

              <div className="h-px bg-gray-100" />

              <ReviewSection title="Details">
                <ReviewRow label="Title" value={data.title || '—'} />
                <div>
                  <p className="text-sm text-gray-500 mb-0.5">Description</p>
                  <p className="text-sm text-gray-900">{data.description || '—'}</p>
                </div>
              </ReviewSection>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeftIcon className="size-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <Button onClick={handleNext}>
              Continue
              <ChevronRightIcon className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : mode === 'new' ? 'Publish listing' : 'Save changes'}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
