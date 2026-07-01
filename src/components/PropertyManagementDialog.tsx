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
import { useLocale } from '../context/LocaleContext';
import { LOCALE_DATE_LOCALE } from '../lib/locale';

export interface ManagedProperty extends Property {
  status: 'rented' | 'available';
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
  const { locale, propertyManagementT: pmT } = useLocale();
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const awaitingTenant = request.status === 'awaiting_tenant';
  const dateLocale = LOCALE_DATE_LOCALE[locale];

  const openFile = async (storagePath: string, fileName: string) => {
    try {
      setOpeningFile(storagePath);
      const url = await getLeaseManagementFileSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : pmT.format('fileOpenError', { name: fileName }),
      );
    } finally {
      setOpeningFile(null);
    }
  };

  const earlyEndDateLabel = request.earlyEndDate
    ? new Date(`${request.earlyEndDate}T12:00:00`).toLocaleDateString(dateLocale)
    : undefined;

  const detail = pmT.requestContentDetail(request.requestType, {
    renewalMonths: request.renewalMonths,
    earlyEndDate: request.earlyEndDate,
    earlyEndDateLabel,
  });

  return (
    <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-5">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Clock className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          {awaitingTenant && request.requestType === 'renew'
            ? pmT.invitedRenew
            : pmT.requestSubmitted}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
          {awaitingTenant && request.requestType === 'renew' ? (
            pmT.format('renewInviteBody', { months: request.renewalMonths ?? pmT.notAvailable })
          ) : (
            pmT.format('pendingReviewBody', { action: pmT.actionLabel(request.requestType) })
          )}
        </p>
      </div>

      <dl className="mt-5 space-y-3 rounded-lg border border-sky-100 bg-white/80 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">{pmT.requestType}</dt>
          <dd className="font-medium text-gray-900">{pmT.actionLabel(request.requestType)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">{pmT.requestStatus}</dt>
          <dd className="font-medium text-gray-900">{pmT.requestStatusLabel(request.status)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-gray-500">{pmT.submittedAt}</dt>
          <dd className="font-medium text-gray-900">
            {new Date(request.createdAt).toLocaleString(dateLocale)}
          </dd>
        </div>
        {detail ? (
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-gray-500">{pmT.requestContent}</dt>
            <dd className="font-medium text-gray-900">{detail}</dd>
          </div>
        ) : null}
        {request.notes.trim() ? (
          <div>
            <dt className="text-gray-500">{pmT.notes}</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-gray-900">
              {request.notes}
            </dd>
          </div>
        ) : null}
      </dl>

      {request.files.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-700">
            {pmT.format('attachments', { count: request.files.length })}
          </p>
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
  const { locale, landlordT, propertyManagementT: pmT, leaseWorkflowT, localizePropertyTitle } = useLocale();
  const displayTitle = property ? localizePropertyTitle(property.title) : '';
  const dateLocale = LOCALE_DATE_LOCALE[locale];
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
  const nextDueLabel = formatLandlordNextDueLabel(
    hasActiveLease,
    {
      nextDueDate: leaseInfo?.nextDueDate ?? null,
      nextRentStatus: leaseInfo?.nextRentStatus ?? null,
    },
    locale,
  );
  const leaseNotes = leaseInfo?.leaseNotes ?? property.leaseNotes ?? '';
  const managementNotes = leaseInfo?.landlordManagementNotes ?? '';
  const moveInLabel = leaseInfo?.moveInDate
    ? new Date(`${leaseInfo.moveInDate}T12:00:00`).toLocaleDateString(dateLocale)
    : pmT.notAvailable;
  const leaseMonthsLabel = pmT.leaseMonthsLabel(leaseInfo?.leaseMonths);
  const lastRenewedLabel = leaseInfo?.lastRenewedAt
    ? new Date(leaseInfo.lastRenewedAt).toLocaleString(dateLocale)
    : pmT.notAvailable;
  const statusLabel =
    property.status === 'rented' ? landlordT.statusRented : landlordT.statusAvailable;
  const pendingRequest = getPendingLeaseManagementRequest(managementRequests);
  const formsDisabled = Boolean(pendingRequest) || actionLoading !== null;

  const runAction = async (action: LandlordLeaseAction) => {
    if (!leaseId) {
      toast.error(pmT.errorNoActiveLease);
      return;
    }

    const files =
      action === 'renew' ? renewFiles : action === 'early_end' ? earlyEndFiles : breachFiles;

    try {
      setActionLoading(action);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(pmT.errorSignIn);

      let requestId = '';
      if (action === 'renew') {
        const months = parseInt(renewMonths, 10);
        if (!Number.isFinite(months) || months < 1 || months > 60) {
          throw new Error(pmT.errorRenewMonthsRange);
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'renew',
          renewalMonths: months,
          notes: renewNotes,
        });
        toast.success(pmT.toastRenewSuccess);
      } else if (action === 'early_end') {
        const parsedEnd = earlyEndDate.trim() ? parseDdMmYyyy(earlyEndDate) : null;
        if (earlyEndDate.trim() && !parsedEnd) {
          throw new Error(pmT.errorEarlyEndDateFormat);
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'early_end',
          earlyEndDate: parsedEnd ?? undefined,
          notes: earlyEndNotes,
        });
        toast.success(pmT.toastEarlyEndSuccess);
      } else {
        if (!breachNotes.trim()) {
          throw new Error(pmT.errorBreachNotesRequired);
        }
        requestId = await submitLandlordLeaseManagementRequest({
          leaseApplicationId: leaseId,
          action: 'breach',
          notes: breachNotes,
        });
        toast.success(pmT.toastBreachSuccess);
      }

      if (!requestId) throw new Error(pmT.errorNoRequestId);
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
      toast.error(e instanceof Error ? e.message : pmT.errorGeneric);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'details' ? pmT.propertyDetails : pmT.manageLease}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {pmT.loadingLease}
            </div>
          ) : (
            <div className="space-y-5">
              <ImageWithFallback
                src={property.image}
                alt={displayTitle}
                className="h-56 w-full rounded-lg object-cover"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label={pmT.propertyTitle} value={displayTitle} />
                <ReadOnlyField label={pmT.status} value={statusLabel} />
                <ReadOnlyField label={pmT.monthlyRent} value={pmT.monthlyRentLabel(property.price)} />
                <ReadOnlyField
                  label={pmT.propertySpecsLabel}
                  value={pmT.propertySpecs(
                    property.area,
                    property.floor,
                    property.bedrooms,
                    property.bathrooms,
                  )}
                />
              </div>

              {mode === 'details' ? (
                <div className="space-y-4">
                  <ReadOnlyField label={pmT.tenant} value={tenantName ?? pmT.noTenant} />
                  {hasActiveLease && leaseInfo?.tenantPhone ? (
                    <ReadOnlyField label={pmT.tenantPhone} value={leaseInfo.tenantPhone} />
                  ) : null}
                  {hasActiveLease && leaseInfo?.tenantEmail ? (
                    <ReadOnlyField label={pmT.tenantEmail} value={leaseInfo.tenantEmail} />
                  ) : null}
                  {hasActiveLease ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <ReadOnlyField label={pmT.moveInDate} value={moveInLabel} />
                      <ReadOnlyField label={pmT.leaseTerm} value={leaseMonthsLabel} />
                    </div>
                  ) : null}
                  <ReadOnlyField label={pmT.nextRentDue} value={nextDueLabel} />
                  <ReadOnlyField label={pmT.pendingApplications} value={String(property.applications)} />
                </div>
              ) : !hasActiveLease ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">{pmT.noActiveLeaseTitle}</p>
                  <p className="text-amber-900/90">{pmT.noActiveLeaseHint}</p>
                  {leaseHint ? (
                    <p className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-xs text-amber-950">
                      {pmT.recentLeaseRecord}
                      {leaseHint.tenantName ? ` ${leaseHint.tenantName} ·` : ''}{' '}
                      {leaseWorkflowT.workflowStatus(leaseHint.status)}
                      {leaseHint.status === 'ended_early' || leaseHint.status === 'ended_breach'
                        ? pmT.endedCanRelist
                        : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800/90">{pmT.noLeaseApplications}</p>
                  )}
                  {property.applications > 0 ? (
                    <p className="text-xs font-medium text-amber-900">
                      {pmT.format('applicationsHint', { count: property.applications })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ReadOnlyField label={pmT.tenantName} value={tenantName ?? pmT.notAvailable} />
                    <ReadOnlyField label={pmT.nextDueDate} value={nextDueLabel} />
                    <ReadOnlyField label={pmT.moveInDate} value={moveInLabel} />
                    <ReadOnlyField label={pmT.currentLeaseTerm} value={leaseMonthsLabel} />
                    <ReadOnlyField label={pmT.lastRenewal} value={lastRenewedLabel} />
                    <ReadOnlyField label={pmT.monthlyRent} value={pmT.monthlyRentLabel(property.price)} />
                  </div>

                  {leaseNotes ? (
                    <ReadOnlyField label={pmT.tenantNotes} value={leaseNotes} />
                  ) : null}
                  {managementNotes ? (
                    <div>
                      <Label>{pmT.leaseManagementLog}</Label>
                      <Textarea value={managementNotes} readOnly className="mt-2 min-h-[72px] resize-none bg-gray-50 text-xs" />
                    </div>
                  ) : null}

                  {pendingRequest ? (
                    <PendingRequestPanel request={pendingRequest} />
                  ) : (
                    <>
                  <p className="text-xs text-gray-500">
                    {pmT.submitHintPrefix}
                    <strong>{pmT.submitHintEmphasis}</strong>
                    {pmT.submitHintSuffix}
                  </p>

                  <ActionCard
                    icon={<RefreshCw className="h-4 w-4" />}
                    title={pmT.renewTitle}
                    description={pmT.renewDesc}
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="renew-months">{pmT.renewalMonths}</Label>
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
                        <Label htmlFor="renew-notes">{pmT.notesOptional}</Label>
                        <Textarea
                          id="renew-notes"
                          value={renewNotes}
                          onChange={(e) => setRenewNotes(e.target.value)}
                          placeholder={pmT.renewNotesPlaceholder}
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
                        {pmT.inviteRenew}
                      </Button>
                    </div>
                  </ActionCard>

                  <ActionCard
                    icon={<CalendarOff className="h-4 w-4" />}
                    title={pmT.earlyEndTitle}
                    description={pmT.earlyEndDesc}
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="early-end-date">{pmT.earlyEndDate}</Label>
                        <Input
                          id="early-end-date"
                          type="text"
                          inputMode="numeric"
                          placeholder={pmT.earlyEndDatePlaceholder}
                          value={earlyEndDate}
                          onChange={(e) => setEarlyEndDate(e.target.value)}
                          className="mt-2 max-w-[12rem]"
                        />
                        <p className="mt-1 text-xs text-gray-500">{pmT.earlyEndDateHint}</p>
                      </div>
                      <div>
                        <Label htmlFor="early-end-notes">{pmT.notesOptional}</Label>
                        <Textarea
                          id="early-end-notes"
                          value={earlyEndNotes}
                          onChange={(e) => setEarlyEndNotes(e.target.value)}
                          placeholder={pmT.earlyEndNotesPlaceholder}
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
                        {pmT.submitEarlyEnd}
                      </Button>
                    </div>
                  </ActionCard>

                  <ActionCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title={pmT.breachTitle}
                    description={pmT.breachDesc}
                    tone="danger"
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="breach-notes">{pmT.breachNotesRequired}</Label>
                        <Textarea
                          id="breach-notes"
                          value={breachNotes}
                          onChange={(e) => setBreachNotes(e.target.value)}
                          placeholder={pmT.breachNotesPlaceholder}
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
                        {pmT.submitBreach}
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
              {confirmAction ? pmT.confirmTitle(confirmAction) : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? pmT.confirmDescription(confirmAction, { months: renewMonths })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>{pmT.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) void runAction(confirmAction);
              }}
              className={confirmAction === 'breach' ? 'bg-red-600 hover:bg-red-700' : undefined}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirmAction === 'renew' ? pmT.sendInvite : pmT.submitRequest}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
