import { type ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, CalendarOff, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { Property } from '../App';
import {
  fetchLatestLeaseApplicationHint,
  fetchLandlordPropertyLeaseDetail,
  fetchLeaseManagementRequestsForLease,
  formatLandlordNextDueLabel,
  getPendingLeaseManagementRequest,
  LEASE_MANAGEMENT_ACTION_LABELS,
  LEASE_MANAGEMENT_REQUEST_STATUS_LABELS,
  submitLandlordLeaseManagementRequest,
  type LandlordLeaseAction,
  type LandlordPropertyLeaseInfo,
  type LeaseManagementRequestSummary,
} from '../lib/landlordPropertyLease';
import {
  formatFileSize,
  getLeaseManagementFileSignedUrl,
  uploadLeaseManagementRequestFiles,
} from '../lib/leaseManagementRequestFiles';
import { LeaseManagementFileUpload } from './LeaseManagementFileUpload';
import { parseDdMmYyyy } from '../lib/dateInput';
import { supabase } from '../lib/supabase';

export interface ManagedProperty extends Property {
  status: '已出租' | '招租中';
  tenantName: string | null;
  nextDueDate: string;
  applications: number;
  leaseApplicationId?: string | null;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  moveInDate?: string | null;
  leaseMonths?: number | null;
  leaseNotes?: string;
}

interface PropertyManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: ManagedProperty | null;
  mode: 'details' | 'lease';
  onSaved?: () => void;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{value}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  children,
  tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        tone === 'danger' ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-gray-50/50'
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-white text-gray-700 shadow-sm'
          }`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PendingRequestPanel({ request }: { request: LeaseManagementRequestSummary }) {
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const awaitingTenant = request.status === 'awaiting_tenant';

  const openFile = async (storagePath: string, fileName: string) => {
    try {
      setOpeningFile(storagePath);
      const url = await getLeaseManagementFileSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `無法開啟「${fileName}」`);
    } finally {
      setOpeningFile(null);
    }
  };

  const detail =
    request.requestType === 'renew'
      ? `延長 ${request.renewalMonths ?? '—'} 個月`
      : request.requestType === 'early_end'
        ? request.earlyEndDate
          ? `結束日 ${new Date(`${request.earlyEndDate}T12:00:00`).toLocaleDateString('zh-HK')}`
          : '結束日：今天（審核時生效）'
        : null;

  return (
    <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-5">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Clock className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          {awaitingTenant && request.requestType === 'renew'
            ? '已邀請租客續約'
            : '申請已提交，處理中'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
          {awaitingTenant && request.requestType === 'renew' ? (
            <>
              已向租客發出續約邀請（延長 <strong>{request.renewalMonths ?? '—'}</strong> 個月）。
              租客確認後，平台才會審核申請。審核完成前無法提交新申請。
            </>
          ) : (
            <>
              平台管理員正在審核你的
              <strong> {LEASE_MANAGEMENT_ACTION_LABELS[request.requestType]} </strong>
              申請。審核完成前無法提交新申請。
            </>
          )}
        </p>
      </div>

      <dl className="mt-5 space-y-3 rounded-lg border border-sky-100 bg-white/80 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">申請類型</dt>
          <dd className="font-medium text-gray-900">
            {LEASE_MANAGEMENT_ACTION_LABELS[request.requestType]}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">狀態</dt>
          <dd className="font-medium text-gray-900">
            {LEASE_MANAGEMENT_REQUEST_STATUS_LABELS[request.status]}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">提交時間</dt>
          <dd className="font-medium text-gray-900">
            {new Date(request.createdAt).toLocaleString('zh-HK')}
          </dd>
        </div>
        {detail ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-gray-500">申請內容</dt>
            <dd className="font-medium text-gray-900">{detail}</dd>
          </div>
        ) : null}
        {request.notes.trim() ? (
          <div>
            <dt className="text-gray-500">備註</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-gray-900">
              {request.notes}
            </dd>
          </div>
        ) : null}
      </dl>

      {request.files.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-700">已上傳附件（{request.files.length}）</p>
          <ul className="space-y-1.5">
            {request.files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
                  disabled={openingFile === f.storagePath}
                  onClick={() => void openFile(f.storagePath, f.fileName)}
                >
                  {openingFile === f.storagePath ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-sky-600" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                  <span className="shrink-0 text-xs text-gray-500">{formatFileSize(f.fileSizeBytes)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyManagementDialog({
  open,
  onOpenChange,
  property,
  mode,
  onSaved,
}: PropertyManagementDialogProps) {
  const [leaseInfo, setLeaseInfo] = useState<LandlordPropertyLeaseInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [renewMonths, setRenewMonths] = useState('12');
  const [renewNotes, setRenewNotes] = useState('');
  const [earlyEndDate, setEarlyEndDate] = useState('');
  const [earlyEndNotes, setEarlyEndNotes] = useState('');
  const [breachNotes, setBreachNotes] = useState('');
  const [renewFiles, setRenewFiles] = useState<File[]>([]);
  const [earlyEndFiles, setEarlyEndFiles] = useState<File[]>([]);
  const [breachFiles, setBreachFiles] = useState<File[]>([]);
  const [managementRequests, setManagementRequests] = useState<LeaseManagementRequestSummary[]>([]);
  const [leaseHint, setLeaseHint] = useState<{
    status: string;
    statusLabel: string;
    tenantName: string | null;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<LandlordLeaseAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<LandlordLeaseAction | null>(null);

  useEffect(() => {
    if (!open || !property) {
      setLeaseInfo(null);
      return;
    }

    setRenewMonths('12');
    setRenewNotes('');
    setEarlyEndDate('');
    setEarlyEndNotes('');
    setBreachNotes('');
    setRenewFiles([]);
    setEarlyEndFiles([]);
    setBreachFiles([]);
    setConfirmAction(null);

    let cancelled = false;
    setDetailLoading(true);

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setDetailLoading(false);
        return;
      }
      try {
        const detail = await fetchLandlordPropertyLeaseDetail(user.id, property.id);
        if (!cancelled) setLeaseInfo(detail);
        const leaseAppId =
          detail.leaseApplicationId ?? property.leaseApplicationId ?? null;
        if (leaseAppId && !cancelled) {
          const requests = await fetchLeaseManagementRequestsForLease(leaseAppId);
          if (!cancelled) setManagementRequests(requests);
          if (!cancelled) setLeaseHint(null);
        } else if (!cancelled) {
          setManagementRequests([]);
          const hint = await fetchLatestLeaseApplicationHint(user.id, property.id);
          if (!cancelled) setLeaseHint(hint);
        }
      } catch {
        if (!cancelled) {
          setLeaseInfo(null);
          setManagementRequests([]);
          setLeaseHint(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, property]);

  if (!property) return null;

  const leaseId = leaseInfo?.leaseApplicationId ?? property.leaseApplicationId ?? null;
  const hasActiveLease = Boolean(leaseId);
  const tenantName = leaseInfo?.tenantName ?? property.tenantName;
  const nextDueLabel = formatLandlordNextDueLabel(hasActiveLease, {
    nextDueDate: leaseInfo?.nextDueDate ?? null,
    nextRentStatus: leaseInfo?.nextRentStatus ?? null,
  });
  const leaseNotes = leaseInfo?.leaseNotes ?? property.leaseNotes ?? '';
  const managementNotes = leaseInfo?.landlordManagementNotes ?? '';
  const moveInLabel = leaseInfo?.moveInDate
    ? new Date(`${leaseInfo.moveInDate}T12:00:00`).toLocaleDateString('zh-HK')
    : '—';
  const leaseMonthsLabel = leaseInfo?.leaseMonths ? `${leaseInfo.leaseMonths} 個月` : '—';
  const lastRenewedLabel = leaseInfo?.lastRenewedAt
    ? new Date(leaseInfo.lastRenewedAt).toLocaleString('zh-HK')
    : '—';
  const pendingRequest = getPendingLeaseManagementRequest(managementRequests);
  const formsDisabled = Boolean(pendingRequest) || actionLoading !== null;

  const runAction = async (action: LandlordLeaseAction) => {
    if (!leaseId) {
      toast.error('找不到進行中的核准租約');
      return;
    }

    const files =
      action === 'renew' ? renewFiles : action === 'early_end' ? earlyEndFiles : breachFiles;

    try {
      setActionLoading(action);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('請先登入');

      let requestId = '';
      if (action === 'renew') {
        const months = parseInt(renewMonths, 10);
        if (!Number.isFinite(months) || months < 1 || months > 60) {
          throw new Error('續約月數須為 1–60');
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'renew',
          renewalMonths: months,
          notes: renewNotes,
        });
        toast.success('已發出續約邀請，等候租客確認');
      } else if (action === 'early_end') {
        const parsedEnd = earlyEndDate.trim() ? parseDdMmYyyy(earlyEndDate) : null;
        if (earlyEndDate.trim() && !parsedEnd) {
          throw new Error('結束日期格式須為 dd/mm/yyyy');
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'early_end',
          earlyEndDate: parsedEnd ?? undefined,
          notes: earlyEndNotes,
        });
        toast.success('已提交提早結束申請，待平台審核');
      } else {
        if (!breachNotes.trim()) {
          throw new Error('請填寫違約說明');
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'breach',
          notes: breachNotes,
        });
        toast.success('已提交違約申請，待平台審核');
      }

      if (!requestId) throw new Error('無法取得申請編號');
      if (files.length > 0) {
        await uploadLeaseManagementRequestFiles(user.id, requestId, files);
      }

      const requests = await fetchLeaseManagementRequestsForLease(leaseId);
      setManagementRequests(requests);
      setRenewNotes('');
      setEarlyEndNotes('');
      setBreachNotes('');
      setRenewFiles([]);
      setEarlyEndFiles([]);
      setBreachFiles([]);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失敗');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const confirmTitles: Record<LandlordLeaseAction, string> = {
    renew: '邀請租客續約',
    early_end: '提交提早結束申請',
    breach: '提交違約申請',
  };

  const confirmDescriptions: Record<LandlordLeaseAction, string> = {
    renew: `將向租客發出續約邀請（延長 ${renewMonths} 個月）。租客確認後，平台才會審核並延長租期。`,
    early_end: '將向平台提交提早結束租約申請。審核通過後租約才會結束，物業改為招租中。',
    breach: '將向平台提交違約申請。審核通過後租約才會以違約結束。',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'details' ? '物業資料' : '管理租約'}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              載入租約資料…
            </div>
          ) : (
            <div className="space-y-5">
              <ImageWithFallback
                src={property.image}
                alt={property.title}
                className="h-56 w-full rounded-lg object-cover"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="物業標題" value={property.title} />
                <ReadOnlyField label="狀態" value={property.status} />
                <ReadOnlyField label="月租" value={`HK$ ${property.price.toLocaleString('en-HK')}`} />
                <ReadOnlyField
                  label="物業規格"
                  value={`${property.area} 平方呎 · ${property.floor} 樓 · ${property.bedrooms} 房 ${property.bathrooms} 廁`}
                />
              </div>

              {mode === 'details' ? (
                <div className="space-y-4">
                  <ReadOnlyField label="租客" value={tenantName ?? '未有租客'} />
                  {hasActiveLease && leaseInfo?.tenantPhone ? (
                    <ReadOnlyField label="租客電話" value={leaseInfo.tenantPhone} />
                  ) : null}
                  {hasActiveLease && leaseInfo?.tenantEmail ? (
                    <ReadOnlyField label="租客電郵" value={leaseInfo.tenantEmail} />
                  ) : null}
                  {hasActiveLease ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <ReadOnlyField label="入住日期" value={moveInLabel} />
                      <ReadOnlyField label="租期" value={leaseMonthsLabel} />
                    </div>
                  ) : null}
                  <ReadOnlyField label="下次租金到期" value={nextDueLabel} />
                  <ReadOnlyField label="待處理申請" value={String(property.applications)} />
                </div>
              ) : !hasActiveLease ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">此物業目前沒有進行中的核准租約</p>
                  <p className="text-amber-900/90">
                    「續約／提早結束／違約」僅適用於平台已核准、租客正在租用的租約。若租約尚在申請或審核中，請先完成租約申請流程。
                  </p>
                  {leaseHint ? (
                    <p className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-xs text-amber-950">
                      最近租約紀錄：
                      {leaseHint.tenantName ? ` ${leaseHint.tenantName} ·` : ''} {leaseHint.statusLabel}
                      {leaseHint.status === 'ended_early' || leaseHint.status === 'ended_breach'
                        ? '（已結束，可重新招租）'
                        : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800/90">此物業尚無租約申請紀錄。</p>
                  )}
                  {property.applications > 0 ? (
                    <p className="text-xs font-medium text-amber-900">
                      你有 {property.applications} 宗待處理租約申請，請在總覽「查看所有申請」處理。
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ReadOnlyField label="租客名稱" value={tenantName ?? '—'} />
                    <ReadOnlyField label="下次到期日" value={nextDueLabel} />
                    <ReadOnlyField label="入住日期" value={moveInLabel} />
                    <ReadOnlyField label="目前租期" value={leaseMonthsLabel} />
                    <ReadOnlyField label="最近續約" value={lastRenewedLabel} />
                    <ReadOnlyField label="月租" value={`HK$ ${property.price.toLocaleString('en-HK')}`} />
                  </div>

                  {leaseNotes ? (
                    <ReadOnlyField label="租客申請備註" value={leaseNotes} />
                  ) : null}
                  {managementNotes ? (
                    <div>
                      <Label>租約管理紀錄</Label>
                      <Textarea value={managementNotes} readOnly className="mt-2 min-h-[72px] resize-none bg-gray-50 text-xs" />
                    </div>
                  ) : null}

                  {pendingRequest ? (
                    <PendingRequestPanel request={pendingRequest} />
                  ) : (
                    <>
                  <p className="text-xs text-gray-500">
                    以下操作均為<strong>提交申請</strong>，須經平台管理員審核後才會更新租約狀態。
                  </p>

                  <ActionCard
                    icon={<RefreshCw className="h-4 w-4" />}
                    title="續約"
                    description="向租客發出續約邀請。租客確認後，平台才會審核並延長租期。"
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="renew-months">延長月數</Label>
                        <Input
                          id="renew-months"
                          type="text"
                          inputMode="numeric"
                          value={renewMonths}
                          onChange={(e) => setRenewMonths(e.target.value.replace(/\D/g, ''))}
                          className="mt-2 max-w-[8rem]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="renew-notes">備註（選填）</Label>
                        <Textarea
                          id="renew-notes"
                          value={renewNotes}
                          onChange={(e) => setRenewNotes(e.target.value)}
                          placeholder="例如：雙方同意續租 12 個月、租金不變…"
                          className="mt-2 min-h-[72px] resize-none"
                        />
                      </div>
                      <LeaseManagementFileUpload
                        id="renew-files"
                        files={renewFiles}
                        onChange={setRenewFiles}
                        disabled={formsDisabled}
                      />
                      <Button
                        type="button"
                        className="w-full bg-black text-white hover:bg-gray-800"
                        disabled={formsDisabled}
                        onClick={() => setConfirmAction('renew')}
                      >
                        {actionLoading === 'renew' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        邀請租客續約
                      </Button>
                    </div>
                  </ActionCard>

                  <ActionCard
                    icon={<CalendarOff className="h-4 w-4" />}
                    title="提早結束租約"
                    description="雙方同意提前退租時向平台申請。核准後租約結束，物業恢復招租。"
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="early-end-date">結束日期</Label>
                        <Input
                          id="early-end-date"
                          type="text"
                          inputMode="numeric"
                          placeholder="dd/mm/yyyy"
                          value={earlyEndDate}
                          onChange={(e) => setEarlyEndDate(e.target.value)}
                          className="mt-2 max-w-[12rem]"
                        />
                        <p className="mt-1 text-xs text-gray-500">留空則以今天為結束日</p>
                      </div>
                      <div>
                        <Label htmlFor="early-end-notes">備註（選填）</Label>
                        <Textarea
                          id="early-end-notes"
                          value={earlyEndNotes}
                          onChange={(e) => setEarlyEndNotes(e.target.value)}
                          placeholder="例如：租客已交還鎖匙…"
                          className="mt-2 min-h-[72px] resize-none"
                        />
                      </div>
                      <LeaseManagementFileUpload
                        id="early-end-files"
                        files={earlyEndFiles}
                        onChange={setEarlyEndFiles}
                        disabled={formsDisabled}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={formsDisabled}
                        onClick={() => setConfirmAction('early_end')}
                      >
                        {actionLoading === 'early_end' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        提交提早結束申請
                      </Button>
                    </div>
                  </ActionCard>

                  <ActionCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title="違約"
                    description="租客違反租約時向平台申請。核准後租約以違約結束，請務必填寫原因。"
                    tone="danger"
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="breach-notes">違約說明（必填）</Label>
                        <Textarea
                          id="breach-notes"
                          value={breachNotes}
                          onChange={(e) => setBreachNotes(e.target.value)}
                          placeholder="例如：拖欠租金超過 30 日、未經同意轉租…"
                          className="mt-2 min-h-[80px] resize-none border-red-200"
                        />
                      </div>
                      <LeaseManagementFileUpload
                        id="breach-files"
                        files={breachFiles}
                        onChange={setBreachFiles}
                        disabled={formsDisabled}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        disabled={formsDisabled || !breachNotes.trim()}
                        onClick={() => setConfirmAction('breach')}
                      >
                        {actionLoading === 'breach' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        提交違約申請
                      </Button>
                    </div>
                  </ActionCard>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? confirmTitles[confirmAction] : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmDescriptions[confirmAction] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) void runAction(confirmAction);
              }}
              className={confirmAction === 'breach' ? 'bg-red-600 hover:bg-red-700' : undefined}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirmAction === 'renew' ? '發出邀請' : '提交申請'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
