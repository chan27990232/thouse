import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '../context/LocaleContext';

import { ArrowLeft, ClipboardList, Droplets, ExternalLink, FileText, House, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { defaultPropertyImage } from '../lib/properties';
import {
  fetchLeaseApplicationsForTenant,
  type TenantLeaseApplicationSummary,
} from '../lib/leaseApplications';
import {
  fetchRentPaymentsForLease,
  isRentPaymentActionable,
  type RentPaymentSummary,
} from '../lib/rentPayments';
import {
  fetchUtilityPaymentsForProperty,
  findPrimaryUtilityPayMonth,
  groupUtilityPaymentsByMonth,
  isUtilityPaymentActionable,
  type UtilityPaymentSummary,
} from '../lib/utilityPayments';
import {
  fetchTenantUtilityBillsForProperty,
  groupUtilityBillsByMonth,
  resolveUtilityMonthReviewStatus,
  sumMonthUtilityPayable,
  type TenantUtilityBillFile,
} from '../lib/tenantUtilityBills';
import { RentPaymentDialog } from './RentPaymentDialog';
import { UtilityPaymentDialog } from './UtilityPaymentDialog';
import {
  fetchTenantAwaitingRenewInvites,
  respondTenantRenewInvite,
  type TenantRenewInviteSummary,
} from '../lib/tenantLeaseManagement';
import { toast } from 'sonner';
import { LOCALE_DATE_LOCALE } from '../lib/locale';

interface TenantMyPropertiesPageProps {
  onBack: () => void;
  onApplicationsClick: () => void;
}

function ActiveLeaseCard({
  lease,
  renewInvite,
  onRenewResponded,
  onPayRent,
  onPayUtility,
}: {
  lease: TenantLeaseApplicationSummary;
  renewInvite: TenantRenewInviteSummary | null;
  onRenewResponded: () => void;
  onPayRent: (p: RentPaymentSummary) => void;
  onPayUtility: (payments: UtilityPaymentSummary[]) => void;
}) {
  const { localizePropertyTitle, localizePropertyDistrict, locale, tenantMyPropertiesT, leaseWorkflowT, utilityBillT, commonT } =
    useLocale();
  const displayTitle = localizePropertyTitle(lease.propertyTitle);
  const displayDistrict = localizePropertyDistrict(lease.propertyDistrict);
  const [rents, setRents] = useState<RentPaymentSummary[]>([]);
  const [utilities, setUtilities] = useState<UtilityPaymentSummary[]>([]);
  const [utilityBills, setUtilityBills] = useState<TenantUtilityBillFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewLoading, setRenewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, u, bills] = await Promise.all([
      fetchRentPaymentsForLease(lease.id),
      fetchUtilityPaymentsForProperty(lease.propertyId),
      fetchTenantUtilityBillsForProperty(lease.propertyId),
    ]);
    setRents(r);
    setUtilities(u);
    setUtilityBills(bills);
    setLoading(false);
  }, [lease.id, lease.propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rentTarget =
    rents.find((p) => isRentPaymentActionable(p)) ??
    rents.find((p) => p.status === 'pending' || p.status === 'overdue') ??
    null;
  const utilityPayMonth = findPrimaryUtilityPayMonth(utilities);
  const utilityMonthPayments = utilityPayMonth
    ? utilities.filter((p) => p.billMonth.slice(0, 7) === utilityPayMonth)
    : [];
  const hasUtilityPayable = utilityMonthPayments.some((p) => isUtilityPaymentActionable(p));
  const utilityBillGroups = groupUtilityBillsByMonth(utilityBills);

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 border-b p-4">
        <ImageWithFallback
          src={lease.propertyImage || defaultPropertyImage}
          alt={displayTitle}
          className="h-24 w-24 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-snug">{displayTitle}</h2>
            <Badge className="bg-green-600 hover:bg-green-600 shrink-0">{tenantMyPropertiesT.activeBadge}</Badge>
          </div>
          {lease.propertyDistrict ? (
            <p className="mt-1 text-sm text-gray-600">{displayDistrict}</p>
          ) : null}
          <p className="mt-2 text-lg font-bold">
            HK${lease.monthlyRent.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-gray-500">{commonT.perMonth}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4 text-sm">
        {renewInvite ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-3 text-sky-950">
            <div className="flex items-start gap-2">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{tenantMyPropertiesT.renewInviteTitle}</p>
                <p
                  className="mt-1 text-xs leading-relaxed text-sky-900/90"
                  dangerouslySetInnerHTML={{
                    __html: tenantMyPropertiesT.format('renewInviteBody', {
                      months: renewInvite.renewalMonths ?? '—',
                      notes: renewInvite.notes.trim()
                        ? tenantMyPropertiesT.format('renewNotesPrefix', { notes: renewInvite.notes.trim() })
                        : '',
                    }),
                  }}
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-sky-800 text-white hover:bg-sky-900"
                    disabled={renewLoading}
                    onClick={() => {
                      void (async () => {
                        try {
                          setRenewLoading(true);
                          await respondTenantRenewInvite(renewInvite.id, true);
                          toast.success(tenantMyPropertiesT.renewSuccess);
                          onRenewResponded();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : tenantMyPropertiesT.actionFailed);
                        } finally {
                          setRenewLoading(false);
                        }
                      })();
                    }}
                  >
                    {renewLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {tenantMyPropertiesT.renewConfirm}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-sky-300 bg-white text-sky-900 hover:bg-sky-100"
                    disabled={renewLoading}
                    onClick={() => {
                      void (async () => {
                        try {
                          setRenewLoading(true);
                          await respondTenantRenewInvite(renewInvite.id, false);
                          toast.success(tenantMyPropertiesT.renewDeclined);
                          onRenewResponded();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : tenantMyPropertiesT.actionFailed);
                        } finally {
                          setRenewLoading(false);
                        }
                      })();
                    }}
                  >
                    {tenantMyPropertiesT.renewDecline}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-gray-500">{tenantMyPropertiesT.areaFloor}</dt>
            <dd>{tenantMyPropertiesT.formatAreaFloor(lease.propertyArea, lease.propertyFloor)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{tenantMyPropertiesT.layout}</dt>
            <dd>{tenantMyPropertiesT.formatLayout(lease.propertyBedrooms, lease.propertyBathrooms)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{tenantMyPropertiesT.moveIn}</dt>
            <dd>
              {lease.moveInDate
                ? new Date(lease.moveInDate + 'T12:00:00').toLocaleDateString(LOCALE_DATE_LOCALE[locale])
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{tenantMyPropertiesT.leaseTerm}</dt>
            <dd>{tenantMyPropertiesT.formatLeaseMonths(lease.leaseMonths)}</dd>
          </div>
        </dl>

        {loading ? (
          <p className="text-xs text-gray-500">{tenantMyPropertiesT.loadingPayments}</p>
        ) : (
          <>
            {rentTarget ? (
              <div
                className={`rounded-lg px-3 py-2 text-xs ${
                  rentTarget.status === 'overdue'
                    ? 'border border-red-300 bg-red-100/90 text-red-950'
                    : 'border border-red-200 bg-red-50/80 text-red-900'
                }`}
              >
                <p className="font-medium">
                  {tenantMyPropertiesT.format('rentPeriod', {
                    index: rentTarget.periodIndex,
                    amount: rentTarget.amount.toLocaleString(),
                  })}
                </p>
                <p className="mt-0.5">
                  {tenantMyPropertiesT.format('rentDue', {
                    deadline: tenantMyPropertiesT.formatDeadline(rentTarget.dueDate),
                  })}
                  <span className={rentTarget.status === 'overdue' ? 'text-red-800/90' : 'text-red-700/80'}>
                    {rentTarget.status === 'overdue'
                      ? tenantMyPropertiesT.rentDueHintOverdue
                      : tenantMyPropertiesT.rentDueHintPending}
                  </span>
                </p>
                <p className={`mt-0.5 ${rentTarget.status === 'overdue' ? 'text-red-900/90' : 'text-red-800/80'}`}>
                  {tenantMyPropertiesT.format('statusLabel', {
                    status: leaseWorkflowT.rentPaymentStatus(rentTarget.status),
                  })}
                </p>
              </div>
            ) : null}
            {utilityPayMonth && utilityMonthPayments.length > 0 ? (
              <div
                className={`rounded-lg px-3 py-2 text-xs ${
                  utilityMonthPayments.some((p) => p.status === 'overdue')
                    ? 'border border-red-200 bg-red-50/80 text-red-900'
                    : 'border border-teal-100 bg-teal-50/80 text-teal-900'
                }`}
              >
                <p className="font-medium">
                  {tenantMyPropertiesT.format('utilitiesMonth', { month: utilityPayMonth })}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {utilityMonthPayments.map((p) => (
                    <li key={p.id}>
                      {tenantMyPropertiesT.billTypeLabel(p.billType, utilityBillT)}
                      {' · HK$'}
                      {p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {' · '}
                      {tenantMyPropertiesT.utilityPaymentStatus(p.status)}
                    </li>
                  ))}
                </ul>
                {utilityMonthPayments[0] ? (
                  <p className="mt-1">
                    {tenantMyPropertiesT.format('utilityDue', {
                      deadline: tenantMyPropertiesT.formatDeadline(utilityMonthPayments[0].dueDate),
                    })}
                    {utilityMonthPayments.some((p) => p.status === 'overdue') ? (
                      <span className="text-red-700/80">{tenantMyPropertiesT.utilityOverdueHint}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : utilityBillGroups.some(([, files]) => resolveUtilityMonthReviewStatus(files) === 'pending_review') ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">{tenantMyPropertiesT.billsPendingReviewTitle}</p>
                <p className="mt-0.5">{tenantMyPropertiesT.billsPendingReviewHint}</p>
              </div>
            ) : null}
            {utilityBillGroups.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs">
                <p className="mb-2 font-medium text-gray-800">{tenantMyPropertiesT.landlordBillsTitle}</p>
                <div className="space-y-2">
                  {utilityBillGroups.map(([month, files]) => {
                    const reviewStatus = resolveUtilityMonthReviewStatus(files);
                    const payable = sumMonthUtilityPayable(files);
                    return (
                      <div key={month} className="rounded-md border border-gray-200 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-800">{month}</span>
                          <span
                            className={
                              reviewStatus === 'approved'
                                ? 'text-green-700'
                                : reviewStatus === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }
                          >
                            {tenantMyPropertiesT.billReviewStatus(reviewStatus)}
                          </span>
                        </div>
                        {payable != null ? (
                          <p className="mt-0.5 text-gray-600">
                            {tenantMyPropertiesT.format('payableAmount', {
                              amount: payable.toLocaleString(),
                            })}
                          </p>
                        ) : null}
                        <ul className="mt-1.5 space-y-1">
                          {files.map((file) => (
                            <li key={file.id} className="flex items-center gap-1.5 text-gray-600">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {file.billType ? (
                                  <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-600">
                                    {tenantMyPropertiesT.billTypeLabel(file.billType, utilityBillT)}
                                  </span>
                                ) : null}
                                {file.originalFilename ?? tenantMyPropertiesT.billFileDefault}
                              </span>
                              {file.viewUrl ? (
                                <a
                                  href={file.viewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex shrink-0 items-center gap-0.5 text-teal-700 hover:underline"
                                >
                                  {tenantMyPropertiesT.view}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : reviewStatus === 'pending_review' ? (
                                <span className="shrink-0 text-amber-600">{tenantMyPropertiesT.reviewing}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            className="flex-1 bg-black text-white hover:bg-gray-800"
            disabled={!rentTarget || !isRentPaymentActionable(rentTarget)}
            onClick={() => rentTarget && onPayRent(rentTarget)}
          >
            {tenantMyPropertiesT.payRent}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-teal-700 text-teal-800 hover:bg-teal-50"
            disabled={!hasUtilityPayable}
            onClick={() => hasUtilityPayable && onPayUtility(utilityMonthPayments)}
          >
            <Droplets className="mr-1.5 h-4 w-4" />
            {tenantMyPropertiesT.payUtilities}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function TenantMyPropertiesPage({ onBack, onApplicationsClick }: TenantMyPropertiesPageProps) {
  const { tenantMyPropertiesT, commonT } = useLocale();
  const [leases, setLeases] = useState<TenantLeaseApplicationSummary[]>([]);
  const [renewInvites, setRenewInvites] = useState<TenantRenewInviteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rentDialog, setRentDialog] = useState<RentPaymentSummary | null>(null);
  const [utilityDialog, setUtilityDialog] = useState<UtilityPaymentSummary[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const all = await fetchLeaseApplicationsForTenant();
        const active = all.filter((l) => l.applicationStatus === 'approved');
        const invites = await fetchTenantAwaitingRenewInvites(active.map((l) => l.id));
        if (!cancelled) {
          setLeases(active);
          setRenewInvites(invites);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : tenantMyPropertiesT.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, tenantMyPropertiesT.loadError]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label={commonT.back}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <House className="h-5 w-5 shrink-0 text-gray-700" />
              <h1 className="truncate text-lg font-semibold">{tenantMyPropertiesT.title}</h1>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onApplicationsClick}>
            <ClipboardList className="mr-1.5 h-4 w-4" />
            {tenantMyPropertiesT.myApplications}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
          <p dangerouslySetInnerHTML={{ __html: tenantMyPropertiesT.deadlineRent }} />
          <p className="mt-1" dangerouslySetInnerHTML={{ __html: tenantMyPropertiesT.deadlinePlatformTransfer }} />
          <p className="mt-1" dangerouslySetInnerHTML={{ __html: tenantMyPropertiesT.deadlineUtility }} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {commonT.loading}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : leases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <House className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-800">{tenantMyPropertiesT.emptyTitle}</p>
            <p className="mt-1 text-xs text-gray-500">{tenantMyPropertiesT.emptyHint}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={onApplicationsClick}>
              {tenantMyPropertiesT.myApplications}
            </Button>
          </div>
        ) : (
          leases.map((lease) => (
            <ActiveLeaseCard
              key={`${lease.id}-${reloadKey}`}
              lease={lease}
              renewInvite={renewInvites.find((inv) => inv.leaseApplicationId === lease.id) ?? null}
              onRenewResponded={() => setReloadKey((k) => k + 1)}
              onPayRent={setRentDialog}
              onPayUtility={setUtilityDialog}
            />
          ))
        )}
      </main>

      {rentDialog ? (
        <RentPaymentDialog
          open
          onOpenChange={(o) => !o && setRentDialog(null)}
          payment={rentDialog}
          onSuccess={() => {
            setRentDialog(null);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}
      {utilityDialog && utilityDialog.length > 0 ? (
        <UtilityPaymentDialog
          open
          onOpenChange={(o) => !o && setUtilityDialog(null)}
          payments={utilityDialog}
          onSuccess={() => {
            setUtilityDialog(null);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}
