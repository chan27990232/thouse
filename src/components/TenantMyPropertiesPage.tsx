import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Droplets, ExternalLink, FileText, House, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { defaultPropertyImage } from '../lib/properties';
import {
  fetchLeaseApplicationsForTenant,
  type TenantLeaseApplicationSummary,
} from '../lib/leaseApplications';
import { formatDeadlineLabel } from '../lib/paymentDeadlines';
import {
  fetchRentPaymentsForLease,
  getRentPaymentStatusLabel,
  isRentPaymentActionable,
  type RentPaymentSummary,
} from '../lib/rentPayments';
import {
  fetchUtilityPaymentsForProperty,
  findPrimaryUtilityPayMonth,
  formatUtilityDueLabel,
  getUtilityPaymentStatusLabel,
  groupUtilityPaymentsByMonth,
  isUtilityPaymentActionable,
  utilityBillTypeLabel,
  type UtilityPaymentSummary,
} from '../lib/utilityPayments';
import {
  fetchTenantUtilityBillsForProperty,
  getUtilityBillReviewStatusLabel,
  groupUtilityBillsByMonth,
  resolveUtilityMonthReviewStatus,
  sumMonthUtilityPayable,
  type TenantUtilityBillFile,
} from '../lib/tenantUtilityBills';
import { RentPaymentDialog } from './RentPaymentDialog';
import { UtilityPaymentDialog } from './UtilityPaymentDialog';

interface TenantMyPropertiesPageProps {
  onBack: () => void;
  onApplicationsClick: () => void;
}

function ActiveLeaseCard({
  lease,
  onPayRent,
  onPayUtility,
}: {
  lease: TenantLeaseApplicationSummary;
  onPayRent: (p: RentPaymentSummary) => void;
  onPayUtility: (payments: UtilityPaymentSummary[]) => void;
}) {
  const [rents, setRents] = useState<RentPaymentSummary[]>([]);
  const [utilities, setUtilities] = useState<UtilityPaymentSummary[]>([]);
  const [utilityBills, setUtilityBills] = useState<TenantUtilityBillFile[]>([]);
  const [loading, setLoading] = useState(true);

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
          alt={lease.propertyTitle}
          className="h-24 w-24 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-snug">{lease.propertyTitle}</h2>
            <Badge className="bg-green-600 hover:bg-green-600 shrink-0">租用中</Badge>
          </div>
          {lease.propertyDistrict ? (
            <p className="mt-1 text-sm text-gray-600">{lease.propertyDistrict}</p>
          ) : null}
          <p className="mt-2 text-lg font-bold">
            HK${lease.monthlyRent.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-gray-500">/月</span>
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-gray-500">面積 / 樓層</dt>
            <dd>
              {lease.propertyArea} 呎 · {lease.propertyFloor} 樓
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">間隔</dt>
            <dd>
              {lease.propertyBedrooms} 房 · {lease.propertyBathrooms} 廁
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">入住日</dt>
            <dd>
              {lease.moveInDate
                ? new Date(lease.moveInDate + 'T12:00:00').toLocaleDateString('zh-HK')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">租期</dt>
            <dd>{lease.leaseMonths} 個月</dd>
          </div>
        </dl>

        {loading ? (
          <p className="text-xs text-gray-500">載入繳費資訊…</p>
        ) : (
          <>
            {rentTarget ? (
              <div
                className={`rounded-lg px-3 py-2 text-xs ${
                  rentTarget.status === 'overdue'
                    ? 'border border-red-200 bg-red-50/80 text-red-900'
                    : 'border border-blue-100 bg-blue-50/80 text-blue-900'
                }`}
              >
                <p className="font-medium">
                  第 {rentTarget.periodIndex} 期租金 · HK${rentTarget.amount.toLocaleString()}
                </p>
                <p className="mt-0.5">
                  須於 {formatDeadlineLabel(rentTarget.dueDate)}繳付
                  <span className={rentTarget.status === 'overdue' ? 'text-red-700/80' : 'text-blue-700/80'}>
                    {rentTarget.status === 'overdue'
                      ? '（已逾期，仍可繳付）'
                      : '（每月租金須於下月 7 日 23:59 前交付）'}
                  </span>
                </p>
                <p className={`mt-0.5 ${rentTarget.status === 'overdue' ? 'text-red-800/80' : 'text-blue-800/80'}`}>
                  狀態：{getRentPaymentStatusLabel(rentTarget.status)}
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
                <p className="font-medium">{utilityPayMonth} 水電煤</p>
                <ul className="mt-1 space-y-0.5">
                  {utilityMonthPayments.map((p) => (
                    <li key={p.id}>
                      {p.billType && p.billType !== 'legacy'
                        ? utilityBillTypeLabel(p.billType)
                        : '水電煤'}
                      {' · HK$'}
                      {p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      {' · '}
                      {getUtilityPaymentStatusLabel(p.status)}
                    </li>
                  ))}
                </ul>
                {utilityMonthPayments[0] ? (
                  <p className="mt-1">
                    須於 {formatUtilityDueLabel(utilityMonthPayments[0].dueDate)}
                    {utilityMonthPayments.some((p) => p.status === 'overdue') ? (
                      <span className="text-red-700/80">（已逾期，仍可繳付）</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : utilityBillGroups.some(([, files]) => resolveUtilityMonthReviewStatus(files) === 'pending_review') ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">水電煤帳單待平台審核</p>
                <p className="mt-0.5">審核通過後即可查看帳單並繳付。</p>
              </div>
            ) : null}
            {utilityBillGroups.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs">
                <p className="mb-2 font-medium text-gray-800">業主上傳水電煤帳單</p>
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
                            {getUtilityBillReviewStatusLabel(reviewStatus)}
                          </span>
                        </div>
                        {payable != null ? (
                          <p className="mt-0.5 text-gray-600">應付 HK${payable.toLocaleString()}</p>
                        ) : null}
                        <ul className="mt-1.5 space-y-1">
                          {files.map((file) => (
                            <li key={file.id} className="flex items-center gap-1.5 text-gray-600">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {file.billType ? (
                                  <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-600">
                                    {utilityBillTypeLabel(file.billType)}
                                  </span>
                                ) : null}
                                {file.originalFilename ?? '帳單檔案'}
                              </span>
                              {file.viewUrl ? (
                                <a
                                  href={file.viewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex shrink-0 items-center gap-0.5 text-teal-700 hover:underline"
                                >
                                  查看
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : reviewStatus === 'pending_review' ? (
                                <span className="shrink-0 text-amber-600">審核中</span>
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
            繳付租金
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-teal-700 text-teal-800 hover:bg-teal-50"
            disabled={!hasUtilityPayable}
            onClick={() => hasUtilityPayable && onPayUtility(utilityMonthPayments)}
          >
            <Droplets className="mr-1.5 h-4 w-4" />
            繳付水電煤
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function TenantMyPropertiesPage({ onBack, onApplicationsClick }: TenantMyPropertiesPageProps) {
  const [leases, setLeases] = useState<TenantLeaseApplicationSummary[]>([]);
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
        if (!cancelled) {
          setLeases(all.filter((l) => l.applicationStatus === 'approved'));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '無法載入');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="返回">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <House className="h-5 w-5 shrink-0 text-gray-700" />
              <h1 className="truncate text-lg font-semibold">我的租盤</h1>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onApplicationsClick}>
            <ClipboardList className="mr-1.5 h-4 w-4" />
            我的租盤申請
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
          <p>· 每月租金須於<strong>下月 7 日 23:59 前</strong>繳付（遇週末或公眾假期提前至上一個工作日）。</p>
          <p className="mt-1">· 平台將於每月 <strong>15 日 23:59 前</strong>把租金轉交業主。</p>
          <p className="mt-1">· 水電煤須於業主上傳帳單後 <strong>21 日內 23:59 前</strong>繳付（遇假期同樣提前）。</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            載入中…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : leases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <House className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-800">暫無正在租用的租盤</p>
            <p className="mt-1 text-xs text-gray-500">簽約完成後會顯示於此；申請進度請查看「我的租盤申請」。</p>
            <Button type="button" variant="outline" className="mt-4" onClick={onApplicationsClick}>
              我的租盤申請
            </Button>
          </div>
        ) : (
          leases.map((lease) => (
            <ActiveLeaseCard
              key={`${lease.id}-${reloadKey}`}
              lease={lease}
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
