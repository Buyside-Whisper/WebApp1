import { AppModuleName } from '../../companies/app-module.enum.js';
import { Company } from '../../companies/company.entity.js';
import { CompanyStatus } from '../../companies/company-status.enum.js';

export type BillingState =
  | 'trial'
  | 'not_started'
  | 'paid'
  | 'due_soon'
  | 'overdue'
  | 'free'
  | 'suspended'
  | 'cancelled';

export interface Billing {
  state: BillingState;
  monthlyTotal: number;
  paidUntil: string | null;
  nextDue: string;
  daysOverdue: number;
}

const DUE_SOON_DAYS = 7;

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function monthlyTotal(company: Pick<Company, 'modules' | 'modulePrices'>): number {
  const cents = company.modules.reduce(
    (sum, module: AppModuleName) => sum + Math.round((company.modulePrices[module] ?? 0) * 100),
    0,
  );
  return cents / 100;
}

export function billingOf(company: Company, paidUntil: string | null): Billing {
  const total = monthlyTotal(company);
  const now = today();
  const coveredUntil = [paidUntil, company.trialEndsOn].filter((d): d is string => !!d).sort().pop() ?? null;
  const nextDue = coveredUntil
    ? addDays(coveredUntil, 1)
    : (company.subscriptionStart ?? company.createdAt.toISOString().slice(0, 10));
  const daysOverdue = Math.max(0, daysBetween(nextDue, now));

  let state: BillingState;
  if (company.status === CompanyStatus.SUSPENDED) {
    state = 'suspended';
  } else if (company.status === CompanyStatus.CANCELLED) {
    state = 'cancelled';
  } else if (total === 0) {
    state = 'free';
  } else if (daysOverdue > 0) {
    state = 'overdue';
  } else if (company.trialEndsOn && company.trialEndsOn >= now && (!paidUntil || paidUntil < now)) {
    state = 'trial';
  } else if (!coveredUntil && nextDue > now) {
    state = 'not_started';
  } else if (daysBetween(now, nextDue) <= DUE_SOON_DAYS) {
    state = 'due_soon';
  } else {
    state = 'paid';
  }

  return { state, monthlyTotal: total, paidUntil, nextDue, daysOverdue };
}
