import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';
import type { UtilityPaymentStatus } from '../../lib/utilityPayments';
import type { UtilityBillReviewStatus } from '../../lib/tenantUtilityBills';
import type { UtilityBillType } from '../../lib/propertyUtilityBills';
import { LOCALE_DATE_LOCALE } from '../../lib/locale';
import { parseDateOnly } from '../../lib/appClock';

const tenantMyPropertiesZhTW = {
  title: '我的租盤',
  myApplications: '我的租盤申請',
  deadlineRent:
    '· 每月租金須於<strong>下月 7 日 23:59 前</strong>繳付（遇週末或公眾假期提前至上一個工作日）。',
  deadlinePlatformTransfer: '· 平台將於每月 <strong>15 日 23:59 前</strong>把租金轉交業主。',
  deadlineUtility:
    '· 水電煤須於業主上傳帳單後 <strong>21 日內 23:59 前</strong>繳付（遇假期同樣提前）。',
  loadError: '無法載入',
  loadingPayments: '載入繳費資訊…',
  emptyTitle: '暫無正在租用的租盤',
  emptyHint: '簽約完成後會顯示於此；申請進度請查看「我的租盤申請」。',
  activeBadge: '租用中',
  renewInviteTitle: '業主邀請你續約',
  renewInviteBody:
    '延長 <strong>{months}</strong> 個月。{notes}請確認是否同意續租；同意後平台才會審核。',
  renewNotesPrefix: '備註：{notes} ',
  renewConfirm: '確認續約',
  renewDecline: '拒絕',
  renewSuccess: '已確認續約，等候平台審核',
  renewDeclined: '已拒絕續約邀請',
  actionFailed: '操作失敗',
  areaFloor: '面積 / 樓層',
  layout: '間隔',
  moveIn: '入住日',
  leaseTerm: '租期',
  rentPeriod: '第 {index} 期租金 · HK${amount}',
  rentDue: '須於 {deadline}繳付',
  rentDueHintPending: '（每月租金須於下月 7 日 23:59 前交付）',
  rentDueHintOverdue: '（已逾期，仍可繳付）',
  statusLabel: '狀態：{status}',
  utilitiesMonth: '{month} 水電煤',
  utilitiesGeneric: '水電煤',
  utilityDue: '須於 {deadline}',
  utilityOverdueHint: '（已逾期，仍可繳付）',
  billsPendingReviewTitle: '水電煤帳單待平台審核',
  billsPendingReviewHint: '審核通過後即可查看帳單並繳付。',
  landlordBillsTitle: '業主上傳水電煤帳單',
  payableAmount: '應付 HK${amount}',
  billFileDefault: '帳單檔案',
  view: '查看',
  reviewing: '審核中',
  payRent: '繳付租金',
  payUtilities: '繳付水電煤',
  utilityPending: '待繳',
  utilityPendingBank: '待入數核對',
  utilityPaid: '已支付',
  utilityOverdue: '逾期',
  reviewPending: '待平台審核',
  reviewApproved: '已核准',
  reviewRejected: '已駁回',
  deadlineBefore: '{date} 23:59 前',
  monthsUnit: '{count} 個月',
  areaFloorValue: '{area} 呎 · {floor} 樓',
  layoutValue: '{bedrooms} 房 · {bathrooms} 廁',
} as const;

export type TenantMyPropertiesMessages = typeof tenantMyPropertiesZhTW;

const tenantMyPropertiesZhCN: TenantMyPropertiesMessages = {
  title: '我的租盘',
  myApplications: '我的租盘申请',
  deadlineRent:
    '· 每月租金须于<strong>下月 7 日 23:59 前</strong>缴付（遇周末或公众假期提前至上一个工作日）。',
  deadlinePlatformTransfer: '· 平台将于每月 <strong>15 日 23:59 前</strong>把租金转交业主。',
  deadlineUtility:
    '· 水电煤须于业主上传账单后 <strong>21 日内 23:59 前</strong>缴付（遇假期同样提前）。',
  loadError: '无法加载',
  loadingPayments: '加载缴费信息…',
  emptyTitle: '暂无正在租用的租盘',
  emptyHint: '签约完成后会显示于此；申请进度请查看「我的租盘申请」。',
  activeBadge: '租用中',
  renewInviteTitle: '业主邀请你续约',
  renewInviteBody:
    '延长 <strong>{months}</strong> 个月。{notes}请确认是否同意续租；同意后平台才会审核。',
  renewNotesPrefix: '备注：{notes} ',
  renewConfirm: '确认续约',
  renewDecline: '拒绝',
  renewSuccess: '已确认续约，等候平台审核',
  renewDeclined: '已拒绝续约邀请',
  actionFailed: '操作失败',
  areaFloor: '面积 / 楼层',
  layout: '间隔',
  moveIn: '入住日',
  leaseTerm: '租期',
  rentPeriod: '第 {index} 期租金 · HK${amount}',
  rentDue: '须于 {deadline}缴付',
  rentDueHintPending: '（每月租金须于下月 7 日 23:59 前交付）',
  rentDueHintOverdue: '（已逾期，仍可缴付）',
  statusLabel: '状态：{status}',
  utilitiesMonth: '{month} 水电煤',
  utilitiesGeneric: '水电煤',
  utilityDue: '须于 {deadline}',
  utilityOverdueHint: '（已逾期，仍可缴付）',
  billsPendingReviewTitle: '水电煤账单待平台审核',
  billsPendingReviewHint: '审核通过后即可查看账单并缴付。',
  landlordBillsTitle: '业主上传水电煤账单',
  payableAmount: '应付 HK${amount}',
  billFileDefault: '账单档案',
  view: '查看',
  reviewing: '审核中',
  payRent: '缴付租金',
  payUtilities: '缴付水电煤',
  utilityPending: '待缴',
  utilityPendingBank: '待入数核对',
  utilityPaid: '已支付',
  utilityOverdue: '逾期',
  reviewPending: '待平台审核',
  reviewApproved: '已核准',
  reviewRejected: '已驳回',
  deadlineBefore: '{date} 23:59 前',
  monthsUnit: '{count} 个月',
  areaFloorValue: '{area} 呎 · {floor} 楼',
  layoutValue: '{bedrooms} 房 · {bathrooms} 厕',
};

const tenantMyPropertiesEn: TenantMyPropertiesMessages = {
  title: 'My rentals',
  myApplications: 'My applications',
  deadlineRent:
    '· Monthly rent is due by <strong>23:59 on the 7th of the following month</strong> (moved earlier if that day is a weekend or public holiday).',
  deadlinePlatformTransfer:
    '· The platform transfers rent to landlords by <strong>23:59 on the 15th</strong> of each month.',
  deadlineUtility:
    '· Utilities are due within <strong>21 days by 23:59</strong> after the landlord uploads bills (holidays apply the same rule).',
  loadError: 'Could not load',
  loadingPayments: 'Loading payment info…',
  emptyTitle: 'No active rentals',
  emptyHint: 'Approved leases appear here. Track applications under “My applications”.',
  activeBadge: 'Active',
  renewInviteTitle: 'Landlord invited you to renew',
  renewInviteBody:
    'Extend for <strong>{months}</strong> month(s). {notes}Please confirm whether you agree; the platform reviews after you accept.',
  renewNotesPrefix: 'Note: {notes} ',
  renewConfirm: 'Confirm renewal',
  renewDecline: 'Decline',
  renewSuccess: 'Renewal confirmed — awaiting platform review',
  renewDeclined: 'Renewal invitation declined',
  actionFailed: 'Action failed',
  areaFloor: 'Area / floor',
  layout: 'Layout',
  moveIn: 'Move-in',
  leaseTerm: 'Lease term',
  rentPeriod: 'Period {index} rent · HK${amount}',
  rentDue: 'Due by {deadline}',
  rentDueHintPending: '(monthly rent due by 23:59 on the 7th of the following month)',
  rentDueHintOverdue: '(overdue — you can still pay)',
  statusLabel: 'Status: {status}',
  utilitiesMonth: '{month} utilities',
  utilitiesGeneric: 'Utilities',
  utilityDue: 'Due by {deadline}',
  utilityOverdueHint: '(overdue — you can still pay)',
  billsPendingReviewTitle: 'Utility bills pending review',
  billsPendingReviewHint: 'You can view and pay after platform approval.',
  landlordBillsTitle: 'Landlord utility bills',
  payableAmount: 'Payable HK${amount}',
  billFileDefault: 'Bill file',
  view: 'View',
  reviewing: 'Under review',
  payRent: 'Pay rent',
  payUtilities: 'Pay utilities',
  utilityPending: 'Due',
  utilityPendingBank: 'Pending transfer verification',
  utilityPaid: 'Paid',
  utilityOverdue: 'Overdue',
  reviewPending: 'Pending review',
  reviewApproved: 'Approved',
  reviewRejected: 'Rejected',
  deadlineBefore: 'before {date} 23:59',
  monthsUnit: '{count} months',
  areaFloorValue: '{area} sq ft · {floor}F',
  layoutValue: '{bedrooms} bed · {bathrooms} bath',
};

export const tenantMyPropertiesMessages: Record<AppLocale, TenantMyPropertiesMessages> = {
  'zh-TW': tenantMyPropertiesZhTW,
  'zh-CN': tenantMyPropertiesZhCN,
  en: tenantMyPropertiesEn,
};

function pluralEn(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function buildTenantMyPropertiesT(locale: AppLocale) {
  const messages = tenantMyPropertiesMessages[locale];
  const dateLocale = LOCALE_DATE_LOCALE[locale];

  return {
    ...messages,
    format(key: keyof TenantMyPropertiesMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    formatDeadline(deadlineIso: string) {
      const date = parseDateOnly(deadlineIso).toLocaleDateString(dateLocale);
      return formatMessage(messages.deadlineBefore, { date });
    },
    formatAreaFloor(area: number, floor: number) {
      if (locale === 'en') {
        return `${area} sq ft · ${floor}F`;
      }
      return formatMessage(messages.areaFloorValue, { area, floor });
    },
    formatLayout(bedrooms: number, bathrooms: number) {
      if (locale === 'en') {
        return `${bedrooms} ${pluralEn(bedrooms, 'bed', 'beds')} · ${bathrooms} ${pluralEn(bathrooms, 'bath', 'baths')}`;
      }
      return formatMessage(messages.layoutValue, { bedrooms, bathrooms });
    },
    formatLeaseMonths(months: number) {
      return formatMessage(messages.monthsUnit, { count: months });
    },
    utilityPaymentStatus(status: UtilityPaymentStatus) {
      switch (status) {
        case 'pending':
          return messages.utilityPending;
        case 'pending_bank':
          return messages.utilityPendingBank;
        case 'paid':
          return messages.utilityPaid;
        case 'overdue':
          return messages.utilityOverdue;
        default:
          return status;
      }
    },
    billReviewStatus(status: UtilityBillReviewStatus) {
      switch (status) {
        case 'pending_review':
          return messages.reviewPending;
        case 'approved':
          return messages.reviewApproved;
        case 'rejected':
          return messages.reviewRejected;
        default:
          return status;
      }
    },
    billTypeLabel(type: string | null | undefined, utilityBillT: { billTypeLabel: (t: UtilityBillType) => string }) {
      if (type === 'water' || type === 'electricity' || type === 'gas') {
        return utilityBillT.billTypeLabel(type);
      }
      return messages.utilitiesGeneric;
    },
  };
}
