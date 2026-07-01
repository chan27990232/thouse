import { useCallback, useEffect, useState } from 'react';
import { Home, Plus, DollarSign, Users, Bell, FileText, FileUp, Wallet, MessageCircle, User, Loader2 } from 'lucide-react';
import { LandlordWalletPanel } from './LandlordWalletPanel';
import { Property } from '../App';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { NoticeDialog } from './NoticeDialog';
import { PropertyManagementDialog } from './PropertyManagementDialog';
import {
  fetchLandlordLeaseInfoByPropertyIds,
  formatLandlordNextDueLabel,
} from '../lib/landlordPropertyLease';
import { ListPropertyWizard } from './ListPropertyWizard';
import { UtilityBillUploadDialog } from './UtilityBillUploadDialog';
import { dedupePropertyRows, defaultPropertyImage } from '../lib/properties';
import { fetchUnreadInquiryCount } from '../lib/conversations';
import {
  fetchPendingApplicationCounts,
  fetchLeaseApplicationsForLandlord,
  respondToLeaseApplication,
  type LandlordLeaseApplicationSummary,
} from '../lib/leaseApplications';
import { notifyLeaseRejectionByEmail } from '../lib/leaseRejectionNotify';
import { type PaymentMethodCode } from '../lib/leaseFirstPayment';
import { supabase } from '../lib/supabase';
import { LOCALE_DATE_LOCALE } from '../lib/locale';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { ThouseHomeFooter } from './ThouseHomeFooter';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLocale } from '../context/LocaleContext';

interface LandlordHomeProps {
  onSignOut: () => void;
  onPropertyClick: (property: Property) => void;
  onChatClick: () => void;
  onProfileClick: () => void;
}

type VerificationState = 'pending' | 'approved' | 'rejected';

interface ManagedProperty extends Property {
  status: 'rented' | 'available';
  tenantName: string | null;
  nextDueDate: string;
  applications: number;
  leaseApplicationId: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  moveInDate: string | null;
  leaseMonths: number | null;
  leaseNotes: string;
  /** 後台審核：未通過則不會在首頁出現 */
  verificationStatus: VerificationState;
  verificationRejectedReason: string;
}

export function LandlordHome({ onSignOut, onPropertyClick, onChatClick, onProfileClick }: LandlordHomeProps) {
  const { locale, landlordT, leaseWorkflowT, localizePropertyTitle } = useLocale();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<ManagedProperty | null>(null);
  const [dialogMode, setDialogMode] = useState<'details' | 'lease'>('details');
  const [managementOpen, setManagementOpen] = useState(false);
  const [utilityDialogOpen, setUtilityDialogOpen] = useState(false);
  const [utilityProperty, setUtilityProperty] = useState<ManagedProperty | null>(null);
  const [applicationsListOpen, setApplicationsListOpen] = useState(false);
  const [applicationsList, setApplicationsList] = useState<LandlordLeaseApplicationSummary[]>([]);
  const [applicationsListLoading, setApplicationsListLoading] = useState(false);
  const [applicationsListError, setApplicationsListError] = useState('');
  const [respondApplicationLoadingId, setRespondApplicationLoadingId] = useState<string | null>(null);
  const [respondFeedback, setRespondFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(
    null
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentLandlordId, setCurrentLandlordId] = useState<string | null>(null);
  const [myProperties, setMyProperties] = useState<ManagedProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const refreshUnread = async () => {
      const n = await fetchUnreadInquiryCount();
      if (!cancelled) setUnreadCount(n);
    };
    void refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadLandlordProperties = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setPropertiesLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMyProperties([]);
      setCurrentLandlordId(null);
      if (!options?.silent) {
        setPropertiesLoading(false);
      }
      return;
    }

    setCurrentLandlordId(user.id);

    const { data, error } = await supabase
      .from('properties')
      .select(
        'id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,status,created_at,verification_status,verification_rejected_reason'
      )
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setMyProperties([]);
      if (!options?.silent) {
        setPropertiesLoading(false);
      }
      return;
    }

    const uniqueRows = dedupePropertyRows(
      data as Array<{
        id: string;
        landlord_id: string;
        title: string | null;
        image: string | null;
        price: number;
        area: number;
        floor: number;
        bedrooms: number;
        bathrooms: number;
        status: string | null;
        created_at: string;
        verification_status: string | null;
        verification_rejected_reason: string | null;
      }>,
      'landlordDashboard'
    );
    uniqueRows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const propertyIds = uniqueRows.map((p) => p.id);
    const [pendingCounts, leaseByProperty] = await Promise.all([
      fetchPendingApplicationCounts(user.id, propertyIds),
      fetchLandlordLeaseInfoByPropertyIds(user.id, propertyIds),
    ]);

    setMyProperties(
      uniqueRows.map((property) => {
        const vs = property.verification_status;
        const ver: VerificationState =
          vs === 'pending' || vs === 'approved' || vs === 'rejected' ? vs : 'pending';
        const lease = leaseByProperty[property.id];
        const hasActiveLease = Boolean(lease?.leaseApplicationId);
        const isRented = property.status === 'rented' || hasActiveLease;
        return {
          id: property.id,
          landlordId: property.landlord_id ?? undefined,
          title: property.title ?? landlordT.unnamedProperty,
          image: property.image || defaultPropertyImage,
          price: Number(property.price ?? 0),
          area: Number(property.area ?? 0),
          floor: Number(property.floor ?? 0),
          bedrooms: Number(property.bedrooms ?? 1),
          bathrooms: Number(property.bathrooms ?? 1),
          isFavorite: false,
          status: isRented ? 'rented' : 'available',
          tenantName: lease?.tenantName ?? null,
          nextDueDate: formatLandlordNextDueLabel(hasActiveLease, {
            nextDueDate: lease?.nextDueDate ?? null,
            nextRentStatus: lease?.nextRentStatus ?? null,
          }, locale),
          applications: pendingCounts[property.id] ?? 0,
          leaseApplicationId: lease?.leaseApplicationId ?? null,
          tenantEmail: lease?.tenantEmail ?? null,
          tenantPhone: lease?.tenantPhone ?? null,
          moveInDate: lease?.moveInDate ?? null,
          leaseMonths: lease?.leaseMonths ?? null,
          leaseNotes: lease?.leaseNotes ?? '',
          verificationStatus: ver,
          verificationRejectedReason: (property.verification_rejected_reason ?? '').trim(),
        };
      })
    );
    if (!options?.silent) {
      setPropertiesLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadLandlordProperties();
  }, [loadLandlordProperties]);

  useEffect(() => {
    if (!applicationsListOpen) return;
    let cancelled = false;
    setRespondFeedback(null);
    setApplicationsListLoading(true);
    setApplicationsListError('');
    void fetchLeaseApplicationsForLandlord()
      .then((rows) => {
        if (!cancelled) setApplicationsList(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setApplicationsListError(err instanceof Error ? err.message : landlordT.loadApplicationsError);
        }
      })
      .finally(() => {
        if (!cancelled) setApplicationsListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationsListOpen]);

  const openPropertyDialog = (property: ManagedProperty, mode: 'details' | 'lease') => {
    setSelectedProperty(property);
    setDialogMode(mode);
    setManagementOpen(true);
  };

  const handleRespondToLease = async (
    row: LandlordLeaseApplicationSummary,
    decision: 'approved' | 'rejected'
  ) => {
    setRespondApplicationLoadingId(row.id);
    setRespondFeedback(null);
    try {
      const beforeRows = await fetchLeaseApplicationsForLandlord();
      const beforeRejectedIds = new Set(
        beforeRows.filter((r) => r.applicationStatus === 'rejected').map((r) => r.id),
      );

      await respondToLeaseApplication(row.id, decision);

      const afterRows = await fetchLeaseApplicationsForLandlord();
      const newlyRejected = afterRows.filter(
        (r) => r.applicationStatus === 'rejected' && !beforeRejectedIds.has(r.id),
      );
      for (const rejected of newlyRejected) {
        void notifyLeaseRejectionByEmail(rejected.id, { previousStatus: 'awaiting_landlord' });
      }

      setRespondFeedback({
        kind: 'ok',
        message: decision === 'approved' ? landlordT.respondApproved : landlordT.respondRejected,
      });
      const rows = await fetchLeaseApplicationsForLandlord();
      setApplicationsList(rows);
      void loadLandlordProperties({ silent: true });
    } catch (e) {
      setRespondFeedback({
        kind: 'err',
        message:
          e instanceof Error
            ? e.message
            : landlordT.respondError,
      });
    } finally {
      setRespondApplicationLoadingId(null);
    }
  };

  const occupiedCount = myProperties.filter((p) => p.status === 'rented').length;
  const pendingApplications = myProperties.reduce((sum, p) => sum + p.applications, 0);
  const monthlyIncome = myProperties
    .filter((p) => p.status === 'rented')
    .reduce((sum, p) => sum + p.price, 0);

  const stats = {
    totalProperties: myProperties.length,
    occupiedProperties: occupiedCount,
    monthlyIncome,
    pendingApplications,
  };

  return (
    <>
    <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col overflow-x-hidden bg-white pb-8">
      {/* Header + 置頂導覽 */}
      <div className="sticky top-0 z-20 shrink-0 border-b bg-white">
        <div className="p-4 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <img src={thouseLogo} alt={landlordT.brandName} className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <span className="tracking-wider">{landlordT.brandName}</span>
                <p className="text-xs text-gray-600">{landlordT.subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <LanguageSwitcher variant="default" />
              <button onClick={() => setNoticeOpen(true)} className="relative rounded-full bg-gray-100 p-2 hover:bg-gray-200" aria-label={landlordT.notice}>
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </button>
              <button onClick={onChatClick} className="relative rounded-full bg-gray-100 p-2 hover:bg-gray-200" aria-label={landlordT.chat}>
                <MessageCircle className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
              </button>
              <button
                onClick={onProfileClick}
                className="rounded-full bg-gray-100 p-2 hover:bg-gray-200"
                aria-label={landlordT.profile}
              >
                <User className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
        <nav
          className="flex border-t border-gray-100 md:px-6 lg:px-8"
          aria-label={landlordT.navAria}
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition sm:flex-none sm:px-6 ${
              activeTab === 'dashboard'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            {landlordT.overview}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition sm:flex-none sm:px-6 ${
              activeTab === 'wallet'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Wallet className="h-4 w-4 shrink-0" aria-hidden />
            {landlordT.wallet}
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 md:px-6 lg:px-8 flex-1 min-h-0 w-full">
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Cards */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Home className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.totalProperties}</span>
                </div>
                <p className="text-sm text-gray-600">{landlordT.totalProperties}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.occupiedProperties}</span>
                </div>
                <p className="text-sm text-gray-600">{landlordT.occupied}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-gray-600" />
                  <span className="text-xl">${stats.monthlyIncome}</span>
                </div>
                <p className="text-sm text-gray-600">{landlordT.monthlyIncome}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.pendingApplications}</span>
                </div>
                <p className="text-sm text-gray-600">{landlordT.pendingApplications}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="mb-3">{landlordT.quickActions}</h2>
              <Dialog open={showAddProperty} onOpenChange={setShowAddProperty}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-black text-white hover:bg-gray-800 mb-2">
                    <Plus className="w-4 h-4 mr-2" />
                    {landlordT.listProperty}
                  </Button>
                </DialogTrigger>
                <DialogContent className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{landlordT.listPropertyTitle}</DialogTitle>
                    <DialogDescription>
                      {landlordT.listPropertyDesc}
                    </DialogDescription>
                  </DialogHeader>
                  {currentLandlordId ? (
                    <ListPropertyWizard
                      key={showAddProperty ? 'open' : 'closed'}
                      landlordId={currentLandlordId}
                      onCancel={() => setShowAddProperty(false)}
                      onSuccess={async () => {
                        await loadLandlordProperties({ silent: true });
                        setShowAddProperty(false);
                      }}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-gray-500">{landlordT.signInToList}</p>
                  )}
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setApplicationsListOpen(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                {landlordT.viewAllApplications}
              </Button>
            </div>

            {/* My Properties */}
            <div>
              <h2 className="mb-3">{landlordT.myPropertiesTitle}</h2>
              {propertiesLoading ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-gray-500">
                  {landlordT.loadingProperties}
                </div>
              ) : myProperties.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                  <p className="text-base text-gray-700 mb-2">{landlordT.noPropertiesTitle}</p>
                  <p className="text-sm text-gray-500 mb-5">{landlordT.noPropertiesHint}</p>
                  <Button className="bg-black text-white hover:bg-gray-800" onClick={() => setShowAddProperty(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {landlordT.listFirstProperty}
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {myProperties.map((property) => (
                    <div key={property.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <ImageWithFallback
                          src={property.image}
                          alt={localizePropertyTitle(property.title)}
                          className="h-44 w-full shrink-0 rounded-md object-cover sm:h-40 sm:w-56"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <h3 className="font-medium truncate">{localizePropertyTitle(property.title)}</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {landlordT.format('propertyMeta', {
                                  area: property.area,
                                  floor: property.floor,
                                  bedrooms: property.bedrooms,
                                  bathrooms: property.bathrooms,
                                })}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-row flex-wrap items-center gap-1 sm:flex-col sm:items-end">
                              <span
                                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                  property.status === 'rented'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {property.status === 'rented' ? landlordT.statusRented : landlordT.statusAvailable}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                  property.verificationStatus === 'approved'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : property.verificationStatus === 'pending'
                                      ? 'bg-gray-100 text-gray-700 border border-gray-200'
                                      : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                              >
                                {property.verificationStatus === 'approved'
                                  ? landlordT.listedOnHome
                                  : property.verificationStatus === 'pending'
                                    ? landlordT.underReview
                                    : landlordT.reviewRejected}
                              </span>
                            </div>
                          </div>
                          {property.verificationStatus === 'rejected' && property.verificationRejectedReason ? (
                            <p className="text-xs text-red-600 mt-1">{property.verificationRejectedReason}</p>
                          ) : null}

                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex justify-between gap-3">
                              <span>{landlordT.monthlyRent}</span>
                              <span className="font-medium text-gray-900">${property.price}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>{landlordT.tenant}</span>
                              <span>{property.tenantName ?? landlordT.noTenant}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>{landlordT.nextRentDue}</span>
                              <span>{property.nextDueDate}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>{landlordT.newApplications}</span>
                              <span>{property.applications}</span>
                            </div>
                          </div>

                          <div className="flex min-h-11 flex-col gap-2 sm:min-h-0 sm:flex-row sm:flex-wrap sm:gap-2">
                            <Button
                              variant="outline"
                              className="w-full min-h-11 flex-1 sm:min-h-10 sm:min-w-[8rem] sm:flex-1"
                            onClick={() => openPropertyDialog(property, 'details')}
                            >
                              {landlordT.viewDetails}
                            </Button>
                          <Button
                            className="w-full min-h-11 flex-1 bg-black text-white hover:bg-gray-800 disabled:opacity-50 sm:min-h-10 sm:min-w-[8rem] sm:flex-1"
                            disabled={!property.leaseApplicationId}
                            title={
                              property.leaseApplicationId
                                ? landlordT.manageLeaseActive
                                : landlordT.manageLeaseDisabled
                            }
                            onClick={() => openPropertyDialog(property, 'lease')}
                          >
                            {landlordT.manageLease}
                          </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full min-h-11 flex-1 border-dashed sm:min-h-10 sm:min-w-full sm:flex-[1_1_100%]"
                              onClick={() => {
                                setUtilityProperty(property);
                                setUtilityDialogOpen(true);
                              }}
                            >
                              <FileUp className="mr-2 h-4 w-4 shrink-0" />
                              {landlordT.uploadUtilityBills}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'wallet' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">{landlordT.walletSection}</h2>
            <LandlordWalletPanel />
          </div>
        )}
      </div>
    </div>

    <ThouseHomeFooter className="w-full" />

      <Dialog open={applicationsListOpen} onOpenChange={setApplicationsListOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0 pr-6 text-left">
            <DialogTitle>{landlordT.allApplicationsTitle}</DialogTitle>
            <DialogDescription>
              {landlordT.allApplicationsDesc}
            </DialogDescription>
            {respondFeedback ? (
              <p
                className={
                  respondFeedback.kind === 'ok'
                    ? 'text-sm text-green-800 pt-2'
                    : 'text-sm text-red-600 pt-2'
                }
                role="status"
              >
                {respondFeedback.message}
              </p>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            {applicationsListLoading ? (
              <p className="py-12 text-center text-sm text-gray-500">{landlordT.loading}</p>
            ) : applicationsListError ? (
              <p className="py-8 text-center text-sm text-red-600">{applicationsListError}</p>
            ) : applicationsList.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">{landlordT.noApplications}</p>
            ) : (
              <ul className="space-y-3">
                {applicationsList.map((row) => {
                  const st = row.applicationStatus;
                  const badgeClass =
                    st === 'awaiting_landlord'
                      ? 'bg-amber-50 text-amber-900 ring-amber-200'
                      : st === 'awaiting_platform_2'
                        ? 'bg-sky-50 text-sky-900 ring-sky-200'
                        : st === 'approved'
                          ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                          : st === 'rejected'
                            ? 'bg-red-50 text-red-800 ring-red-200'
                            : 'bg-gray-50 text-gray-800 ring-gray-200';

                  const payMethodUi = row.paymentMethod
                    ? leaseWorkflowT.paymentMethod(row.paymentMethod as PaymentMethodCode)
                    : '—';

                  return (
                    <li
                      key={row.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{localizePropertyTitle(row.propertyTitle)}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {landlordT.format('appliedAt', {
                              time: new Date(row.createdAt).toLocaleString(LOCALE_DATE_LOCALE[locale]),
                            })}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeClass}`}
                        >
                          {leaseWorkflowT.workflowStatus(row.applicationStatus)}
                        </span>
                      </div>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-gray-500">{landlordT.applicant}</dt>
                          <dd className="font-medium">{row.applicantName}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.phone}</dt>
                          <dd className="break-all">{row.phone}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.email}</dt>
                          <dd className="break-all">{row.email}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.firstPaymentAmount}</dt>
                          <dd>HK${row.firstPaymentTotal.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.leaseMonthsField}</dt>
                          <dd>{row.leaseMonths}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.moveInDate}</dt>
                          <dd>
                            {row.moveInDate
                              ? new Date(row.moveInDate + 'T12:00:00').toLocaleDateString(LOCALE_DATE_LOCALE[locale])
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.paymentMethod}</dt>
                          <dd>{payMethodUi}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{landlordT.paymentStatus}</dt>
                          <dd>{leaseWorkflowT.landlordPaymentStatus(row.paymentStatus)}</dd>
                        </div>
                        {row.paymentReference ? (
                          <div className="sm:col-span-2">
                            <dt className="text-xs text-gray-500">{landlordT.referenceNo}</dt>
                            <dd className="break-all font-mono text-xs">{row.paymentReference}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {st === 'awaiting_landlord' ? (
                        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                          <Button
                            type="button"
                            className="flex-1 gap-2 bg-black text-white hover:bg-gray-800"
                            disabled={respondApplicationLoadingId !== null || applicationsListLoading}
                            onClick={() => void handleRespondToLease(row, 'approved')}
                          >
                            {respondApplicationLoadingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                            ) : null}
                            {landlordT.acceptApplication}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 gap-2 border-red-300 text-red-700 hover:bg-red-50"
                            disabled={respondApplicationLoadingId !== null || applicationsListLoading}
                            onClick={() => void handleRespondToLease(row, 'rejected')}
                          >
                            {respondApplicationLoadingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                            ) : null}
                            {landlordT.rejectApplication}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} userRole="landlord" onOpenChat={onChatClick} />
      <PropertyManagementDialog
        open={managementOpen}
        onOpenChange={setManagementOpen}
        property={selectedProperty}
        mode={dialogMode}
        onSaved={() => void loadLandlordProperties({ silent: true })}
      />
      <UtilityBillUploadDialog
        open={utilityDialogOpen}
        onOpenChange={(o) => {
          setUtilityDialogOpen(o);
          if (!o) setUtilityProperty(null);
        }}
        property={utilityProperty ? { id: utilityProperty.id, title: utilityProperty.title } : null}
      />
    </>
  );
}
