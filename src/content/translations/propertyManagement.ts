import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';
import type {
  LandlordLeaseAction,
  LeaseManagementRequestStatus,
} from '../../lib/landlordPropertyLease';

const propertyManagementZhTW = {
  propertyDetails: '物業資料',
  manageLease: '管理租約',
  loadingLease: '載入租約資料…',
  propertyTitle: '物業標題',
  status: '狀態',
  monthlyRent: '月租',
  propertySpecsLabel: '物業規格',
  propertySpecs: '{area} 平方呎 · {floor} 樓 · {bedrooms} 房 {bathrooms} 廁',
  tenant: '租客',
  noTenant: '未有租客',
  tenantPhone: '租客電話',
  tenantEmail: '租客電郵',
  moveInDate: '入住日期',
  leaseTerm: '租期',
  leaseMonths: '{months} 個月',
  nextRentDue: '下次租金到期',
  pendingApplications: '待處理申請',
  tenantName: '租客名稱',
  nextDueDate: '下次到期日',
  currentLeaseTerm: '目前租期',
  lastRenewal: '最近續約',
  tenantNotes: '租客申請備註',
  leaseManagementLog: '租約管理紀錄',
  notAvailable: '—',
  noActiveLeaseTitle: '此物業目前沒有進行中的核准租約',
  noActiveLeaseHint:
    '「續約／提早結束／違約」僅適用於平台已核准、租客正在租用的租約。若租約尚在申請或審核中，請先完成租約申請流程。',
  renewTitle: '續約',
  renewDesc: '向租客發出續約邀請。租客確認後，平台才會審核並延長租期。',
  earlyEndTitle: '提早結束租約',
  earlyEndDesc: '雙方同意提前退租時向平台申請。核准後租約結束，物業恢復招租。',
  breachTitle: '違約',
  breachDesc: '租客違反租約時向平台申請。核准後租約以違約結束，請務必填寫原因。',
  renewalMonths: '延長月數',
  notesOptional: '備註（選填）',
  earlyEndDate: '結束日期',
  earlyEndDatePlaceholder: 'dd/mm/yyyy',
  earlyEndDateHint: '留空則以今天為結束日',
  breachNotesRequired: '違約說明（必填）',
  renewNotesPlaceholder: '例如：雙方同意續租 12 個月、租金不變…',
  earlyEndNotesPlaceholder: '例如：租客已交還鎖匙…',
  breachNotesPlaceholder: '例如：拖欠租金超過 30 日、未經同意轉租…',
  inviteRenew: '邀請租客續約',
  submitEarlyEnd: '提交提早結束申請',
  submitBreach: '提交違約申請',
  cancel: '取消',
  sendInvite: '發出邀請',
  submitRequest: '提交申請',
  confirmRenew: '邀請租客續約',
  confirmEarlyEnd: '提交提早結束申請',
  confirmBreach: '提交違約申請',
  confirmRenewDesc:
    '將向租客發出續約邀請（延長 {months} 個月）。租客確認後，平台才會審核並延長租期。',
  confirmEarlyEndDesc: '將向平台提交提早結束租約申請。審核通過後租約才會結束，物業改為招租中。',
  confirmBreachDesc: '將向平台提交違約申請。審核通過後租約才會以違約結束。',
  invitedRenew: '已邀請租客續約',
  requestSubmitted: '申請已提交，處理中',
  renewInviteBody:
    '已向租客發出續約邀請（延長 {months} 個月）。租客確認後，平台才會審核申請。審核完成前無法提交新申請。',
  pendingReviewBody: '平台管理員正在審核你的 {action} 申請。審核完成前無法提交新申請。',
  requestType: '申請類型',
  requestStatus: '狀態',
  submittedAt: '提交時間',
  requestContent: '申請內容',
  notes: '備註',
  attachments: '已上傳附件（{count}）',
  requestContentRenew: '延長 {months} 個月',
  requestContentEarlyEnd: '結束日 {date}',
  requestContentEarlyEndToday: '結束日：今天（審核時生效）',
  actionRenew: '續約',
  actionEarlyEnd: '提早結束租約',
  actionBreach: '違約',
  awaitingTenant: '等候租客確認',
  pending: '待平台審核',
  approved: '已核准',
  rejected: '已駁回',
  submitHintPrefix: '以下操作均為',
  submitHintEmphasis: '提交申請',
  submitHintSuffix: '，須經平台管理員審核後才會更新租約狀態。',
  recentLeaseRecord: '最近租約紀錄：',
  endedCanRelist: '（已結束，可重新招租）',
  noLeaseApplications: '此物業尚無租約申請紀錄。',
  applicationsHint: '你有 {count} 宗待處理租約申請，請在總覽「查看所有申請」處理。',
  errorNoActiveLease: '找不到進行中的核准租約',
  errorSignIn: '請先登入',
  errorRenewMonthsRange: '續約月數須為 1–60',
  errorEarlyEndDateFormat: '結束日期格式須為 dd/mm/yyyy',
  errorBreachNotesRequired: '請填寫違約說明',
  errorNoRequestId: '無法取得申請編號',
  errorGeneric: '操作失敗',
  toastRenewSuccess: '已發出續約邀請，等候租客確認',
  toastEarlyEndSuccess: '已提交提早結束申請，待平台審核',
  toastBreachSuccess: '已提交違約申請，待平台審核',
  fileOpenError: '無法開啟「{name}」',
  mgmtFilesLabel: '證明文件（選填）',
  mgmtFilesSummary: '{count}/{max} 個 · {size} / {maxSize}',
  mgmtSelectFiles: '選擇檔案',
  mgmtRemoveFile: '移除 {name}',
  mgmtFilesHint: '可上傳合約、對話紀錄、照片等，最多 {max} 個檔案，總計 10GB 以內。',
  mgmtAddFileError: '無法加入檔案',
} as const;

export type PropertyManagementMessages = typeof propertyManagementZhTW;

const propertyManagementZhCN: PropertyManagementMessages = {
  propertyDetails: '物业资料',
  manageLease: '管理租约',
  loadingLease: '载入租约资料…',
  propertyTitle: '物业标题',
  status: '状态',
  monthlyRent: '月租',
  propertySpecsLabel: '物业规格',
  propertySpecs: '{area} 平方呎 · {floor} 楼 · {bedrooms} 房 {bathrooms} 厕',
  tenant: '租客',
  noTenant: '未有租客',
  tenantPhone: '租客电话',
  tenantEmail: '租客电邮',
  moveInDate: '入住日期',
  leaseTerm: '租期',
  leaseMonths: '{months} 个月',
  nextRentDue: '下次租金到期',
  pendingApplications: '待处理申请',
  tenantName: '租客名称',
  nextDueDate: '下次到期日',
  currentLeaseTerm: '目前租期',
  lastRenewal: '最近续约',
  tenantNotes: '租客申请备注',
  leaseManagementLog: '租约管理纪录',
  notAvailable: '—',
  noActiveLeaseTitle: '此物业目前没有进行中的核准租约',
  noActiveLeaseHint:
    '「续约／提早结束／违约」仅适用于平台已核准、租客正在租用的租约。若租约尚在申请或审核中，请先完成租约申请流程。',
  renewTitle: '续约',
  renewDesc: '向租客发出续约邀请。租客确认后，平台才会审核并延长租期。',
  earlyEndTitle: '提早结束租约',
  earlyEndDesc: '双方同意提前退租时向平台申请。核准后租约结束，物业恢复招租。',
  breachTitle: '违约',
  breachDesc: '租客违反租约时向平台申请。核准后租约以违约结束，请务必填写原因。',
  renewalMonths: '延长月数',
  notesOptional: '备注（选填）',
  earlyEndDate: '结束日期',
  earlyEndDatePlaceholder: 'dd/mm/yyyy',
  earlyEndDateHint: '留空则以今天为结束日',
  breachNotesRequired: '违约说明（必填）',
  renewNotesPlaceholder: '例如：双方同意续租 12 个月、租金不变…',
  earlyEndNotesPlaceholder: '例如：租客已交还锁匙…',
  breachNotesPlaceholder: '例如：拖欠租金超过 30 日、未经同意转租…',
  inviteRenew: '邀请租客续约',
  submitEarlyEnd: '提交提早结束申请',
  submitBreach: '提交违约申请',
  cancel: '取消',
  sendInvite: '发出邀请',
  submitRequest: '提交申请',
  confirmRenew: '邀请租客续约',
  confirmEarlyEnd: '提交提早结束申请',
  confirmBreach: '提交违约申请',
  confirmRenewDesc:
    '将向租客发出续约邀请（延长 {months} 个月）。租客确认后，平台才会审核并延长租期。',
  confirmEarlyEndDesc: '将向平台提交提早结束租约申请。审核通过后租约才会结束，物业改为招租中。',
  confirmBreachDesc: '将向平台提交违约申请。审核通过后租约才会以违约结束。',
  invitedRenew: '已邀请租客续约',
  requestSubmitted: '申请已提交，处理中',
  renewInviteBody:
    '已向租客发出续约邀请（延长 {months} 个月）。租客确认后，平台才会审核申请。审核完成前无法提交新申请。',
  pendingReviewBody: '平台管理员正在审核你的 {action} 申请。审核完成前无法提交新申请。',
  requestType: '申请类型',
  requestStatus: '状态',
  submittedAt: '提交时间',
  requestContent: '申请内容',
  notes: '备注',
  attachments: '已上传附件（{count}）',
  requestContentRenew: '延长 {months} 个月',
  requestContentEarlyEnd: '结束日 {date}',
  requestContentEarlyEndToday: '结束日：今天（审核时生效）',
  actionRenew: '续约',
  actionEarlyEnd: '提早结束租约',
  actionBreach: '违约',
  awaitingTenant: '等候租客确认',
  pending: '待平台审核',
  approved: '已核准',
  rejected: '已驳回',
  submitHintPrefix: '以下操作均为',
  submitHintEmphasis: '提交申请',
  submitHintSuffix: '，须经平台管理员审核后才会更新租约状态。',
  recentLeaseRecord: '最近租约纪录：',
  endedCanRelist: '（已结束，可重新招租）',
  noLeaseApplications: '此物业尚无租约申请纪录。',
  applicationsHint: '你有 {count} 宗待处理租约申请，请在总览「查看所有申请」处理。',
  errorNoActiveLease: '找不到进行中的核准租约',
  errorSignIn: '请先登录',
  errorRenewMonthsRange: '续约月数须为 1–60',
  errorEarlyEndDateFormat: '结束日期格式须为 dd/mm/yyyy',
  errorBreachNotesRequired: '请填写违约说明',
  errorNoRequestId: '无法取得申请编号',
  errorGeneric: '操作失败',
  toastRenewSuccess: '已发出续约邀请，等候租客确认',
  toastEarlyEndSuccess: '已提交提早结束申请，待平台审核',
  toastBreachSuccess: '已提交违约申请，待平台审核',
  fileOpenError: '无法开启「{name}」',
  mgmtFilesLabel: '证明文件（选填）',
  mgmtFilesSummary: '{count}/{max} 个 · {size} / {maxSize}',
  mgmtSelectFiles: '选择档案',
  mgmtRemoveFile: '移除 {name}',
  mgmtFilesHint: '可上传合约、对话纪录、照片等，最多 {max} 个档案，总计 10GB 以内。',
  mgmtAddFileError: '无法加入档案',
};

const propertyManagementEn: PropertyManagementMessages = {
  propertyDetails: 'Property Details',
  manageLease: 'Manage Lease',
  loadingLease: 'Loading lease details…',
  propertyTitle: 'Title',
  status: 'Status',
  monthlyRent: 'Monthly Rent',
  propertySpecsLabel: 'Property Specs',
  propertySpecs: '{area} sq ft · Fl. {floor} · {bedrooms} bed {bathrooms} bath',
  tenant: 'Tenant',
  noTenant: 'No Tenant',
  tenantPhone: 'Tenant Phone',
  tenantEmail: 'Tenant Email',
  moveInDate: 'Move-In Date',
  leaseTerm: 'Lease Term',
  leaseMonths: '{months} months',
  nextRentDue: 'Next Rent Due',
  pendingApplications: 'Pending Applications',
  tenantName: 'Tenant Name',
  nextDueDate: 'Next Due Date',
  currentLeaseTerm: 'Current Lease Term',
  lastRenewal: 'Last Renewal',
  tenantNotes: 'Tenant Application Notes',
  leaseManagementLog: 'Lease Management Log',
  notAvailable: '—',
  noActiveLeaseTitle: 'This property has no approved active lease',
  noActiveLeaseHint:
    'Renewal, early termination, and breach actions apply only to platform-approved leases with an active tenant. If a lease is still in application or review, complete that process first.',
  renewTitle: 'Renew',
  renewDesc:
    'Send a renewal invitation to the tenant. After they confirm, the platform will review and extend the lease.',
  earlyEndTitle: 'Early Termination',
  earlyEndDesc:
    'Apply to the platform when both parties agree to end early. After approval, the lease ends and the listing becomes available.',
  breachTitle: 'Breach',
  breachDesc:
    'Apply to the platform when the tenant breaches the lease. After approval, the lease ends for breach. A reason is required.',
  renewalMonths: 'Extension (months)',
  notesOptional: 'Notes (Optional)',
  earlyEndDate: 'End Date',
  earlyEndDatePlaceholder: 'dd/mm/yyyy',
  earlyEndDateHint: 'Leave blank to use today as the end date',
  breachNotesRequired: 'Breach Details (Required)',
  renewNotesPlaceholder: 'e.g. Both parties agree to renew 12 months at the same rent…',
  earlyEndNotesPlaceholder: 'e.g. Tenant has returned keys…',
  breachNotesPlaceholder: 'e.g. Rent overdue 30+ days, unauthorized sublet…',
  inviteRenew: 'Invite Tenant to Renew',
  submitEarlyEnd: 'Submit Early Termination',
  submitBreach: 'Submit Breach Request',
  cancel: 'Cancel',
  sendInvite: 'Send Invitation',
  submitRequest: 'Submit Request',
  confirmRenew: 'Invite Tenant to Renew',
  confirmEarlyEnd: 'Submit Early Termination',
  confirmBreach: 'Submit Breach Request',
  confirmRenewDesc:
    'A renewal invitation will be sent to the tenant (extend {months} months). After they confirm, the platform will review and extend the lease.',
  confirmEarlyEndDesc:
    'An early termination request will be submitted to the platform. The lease ends only after approval; the listing will become available.',
  confirmBreachDesc:
    'A breach request will be submitted to the platform. The lease ends for breach only after approval.',
  invitedRenew: 'Renewal Invitation Sent',
  requestSubmitted: 'Request Submitted — In Progress',
  renewInviteBody:
    'A renewal invitation has been sent to the tenant (extend {months} months). After they confirm, the platform will review the request. You cannot submit a new request until review is complete.',
  pendingReviewBody:
    'Platform staff are reviewing your {action} request. You cannot submit a new request until review is complete.',
  requestType: 'Request Type',
  requestStatus: 'Status',
  submittedAt: 'Submitted at',
  requestContent: 'Request Details',
  notes: 'Notes',
  attachments: 'Attachments ({count})',
  requestContentRenew: 'Extend {months} months',
  requestContentEarlyEnd: 'End Date {date}',
  requestContentEarlyEndToday: 'End Date: today (effective on approval)',
  actionRenew: 'Renewal',
  actionEarlyEnd: 'Early Termination',
  actionBreach: 'Breach',
  awaitingTenant: 'Awaiting Tenant',
  pending: 'Pending Platform Review',
  approved: 'Approved',
  rejected: 'Rejected',
  submitHintPrefix: 'All actions below are ',
  submitHintEmphasis: 'requests',
  submitHintSuffix: ' and require platform review before the lease status updates.',
  recentLeaseRecord: 'Recent Lease Record:',
  endedCanRelist: ' (ended — can relist)',
  noLeaseApplications: 'No lease application history for this property.',
  applicationsHint:
    'You have {count} pending lease application(s). Handle them from Overview → View all applications.',
  errorNoActiveLease: 'No approved active lease found',
  errorSignIn: 'Please sign in first',
  errorRenewMonthsRange: 'Renewal months must be 1–60',
  errorEarlyEndDateFormat: 'End Date must be dd/mm/yyyy',
  errorBreachNotesRequired: 'Please enter breach details',
  errorNoRequestId: 'Could not obtain request ID',
  errorGeneric: 'Action failed',
  toastRenewSuccess: 'Renewal Invitation Sent — awaiting tenant confirmation',
  toastEarlyEndSuccess: 'Early Termination submitted — pending platform review',
  toastBreachSuccess: 'Breach request submitted — pending platform review',
  fileOpenError: 'Could not open “{name}”',
  mgmtFilesLabel: 'Supporting Documents (Optional)',
  mgmtFilesSummary: '{count}/{max} files · {size} / {maxSize}',
  mgmtSelectFiles: 'Choose Files',
  mgmtRemoveFile: 'Remove {name}',
  mgmtFilesHint: 'Contracts, chat logs, photos, etc. Up to {max} files, 10GB total.',
  mgmtAddFileError: 'Could not add file',
};

export const propertyManagementMessages: Record<AppLocale, PropertyManagementMessages> = {
  'zh-TW': propertyManagementZhTW,
  'zh-CN': propertyManagementZhCN,
  en: propertyManagementEn,
};

const ACTION_KEYS: Record<LandlordLeaseAction, keyof PropertyManagementMessages> = {
  renew: 'actionRenew',
  early_end: 'actionEarlyEnd',
  breach: 'actionBreach',
};

const STATUS_KEYS: Record<LeaseManagementRequestStatus, keyof PropertyManagementMessages> = {
  awaiting_tenant: 'awaitingTenant',
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
};

const CONFIRM_TITLE_KEYS: Record<LandlordLeaseAction, keyof PropertyManagementMessages> = {
  renew: 'confirmRenew',
  early_end: 'confirmEarlyEnd',
  breach: 'confirmBreach',
};

const CONFIRM_DESC_KEYS: Record<LandlordLeaseAction, keyof PropertyManagementMessages> = {
  renew: 'confirmRenewDesc',
  early_end: 'confirmEarlyEndDesc',
  breach: 'confirmBreachDesc',
};

export function buildPropertyManagementT(locale: AppLocale) {
  const messages = propertyManagementMessages[locale];
  return {
    ...messages,
    format(key: keyof PropertyManagementMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    propertySpecs(area: number, floor: number | string, bedrooms: number, bathrooms: number) {
      return formatMessage(messages.propertySpecs, { area, floor, bedrooms, bathrooms });
    },
    leaseMonthsLabel(months: number | null | undefined) {
      if (!months) return messages.notAvailable;
      return formatMessage(messages.leaseMonths, { months });
    },
    monthlyRentLabel(price: number) {
      return `HK$ ${price.toLocaleString('en-HK')}`;
    },
    actionLabel(action: LandlordLeaseAction) {
      return messages[ACTION_KEYS[action]];
    },
    requestStatusLabel(status: LeaseManagementRequestStatus) {
      return messages[STATUS_KEYS[status]];
    },
    confirmTitle(action: LandlordLeaseAction) {
      return messages[CONFIRM_TITLE_KEYS[action]];
    },
    confirmDescription(action: LandlordLeaseAction, vars?: { months?: string | number }) {
      const key = CONFIRM_DESC_KEYS[action];
      return formatMessage(messages[key], vars);
    },
    requestContentDetail(
      requestType: LandlordLeaseAction,
      opts: { renewalMonths?: number | null; earlyEndDate?: string | null; earlyEndDateLabel?: string },
    ) {
      if (requestType === 'renew') {
        const months = opts.renewalMonths ?? messages.notAvailable;
        return formatMessage(messages.requestContentRenew, { months });
      }
      if (requestType === 'early_end') {
        if (opts.earlyEndDate && opts.earlyEndDateLabel) {
          return formatMessage(messages.requestContentEarlyEnd, { date: opts.earlyEndDateLabel });
        }
        return messages.requestContentEarlyEndToday;
      }
      return null;
    },
  };
}
