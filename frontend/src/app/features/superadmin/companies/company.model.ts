import { AppModule } from '../../../core/auth/auth.model';

export type CompanyStatus = 'active' | 'suspended' | 'cancelled';
export type LegalForm = 'llc' | 'jsc' | 'individual_entrepreneur' | 'other';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other';
export type BillingState =
  | 'trial'
  | 'not_started'
  | 'paid'
  | 'due_soon'
  | 'overdue'
  | 'free'
  | 'suspended'
  | 'cancelled';

export const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  llc: 'LLC (შპს)',
  jsc: 'JSC (სს)',
  individual_entrepreneur: 'Individual entrepreneur (ი/მ)',
  other: 'Other',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

export const BILLING_LABELS: Record<BillingState, string> = {
  trial: 'Trial',
  not_started: 'Not started',
  paid: 'Paid',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  free: 'No charge',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

export const BILLING_BADGES: Record<BillingState, string> = {
  trial: 'badge--admin',
  not_started: 'badge--inactive',
  paid: 'badge--active',
  due_soon: 'badge--transit',
  overdue: 'badge--cancelled',
  free: 'badge--inactive',
  suspended: 'badge--cancelled',
  cancelled: 'badge--inactive',
};

export interface Billing {
  state: BillingState;
  monthlyTotal: number;
  paidUntil: string | null;
  nextDue: string;
  daysOverdue: number;
}

export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  legalForm: LegalForm | null;
  identificationCode: string | null;
  modules: AppModule[];
  modulePrices: Partial<Record<AppModule, number>>;
  status: CompanyStatus;
  subscriptionStart: string | null;
  trialEndsOn: string | null;
  billing: Billing;
  createdAt: string;
  adminName: string | null;
  adminUsername: string | null;
  employeeCount: number;
}

export interface CompanyPayment {
  id: string;
  paidOn: string;
  amount: number;
  method: PaymentMethod;
  periodFrom: string;
  periodTo: string;
  reference: string | null;
  note: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface CompanyDetail extends Company {
  vatPayer: boolean;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  updatedAt: string;
  payments: CompanyPayment[];
  totalPaid: number;
}

export interface CompanyProfilePayload {
  name: string;
  legalName: string;
  legalForm: LegalForm;
  identificationCode: string;
  vatPayer: boolean;
  legalAddress: string;
  contactEmail: string;
  contactPhone: string;
  modules: AppModule[];
  modulePrices: Partial<Record<AppModule, number>>;
  subscriptionStart: string;
  trialEndsOn: string | null;
  notes: string | null;
}

export interface CreateCompanyPayload extends CompanyProfilePayload {
  adminFirstName: string;
  adminLastName: string;
}

export interface PaymentPayload {
  paidOn: string;
  amount: number;
  method: PaymentMethod;
  periodFrom: string;
  periodTo: string;
  reference: string | null;
  note: string | null;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
