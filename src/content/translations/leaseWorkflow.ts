import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';
import type { LeaseWorkflowStatus } from '../../lib/leaseApplications';
import type { PaymentMethodCode } from '../../lib/leaseFirstPayment';
import type { RentPaymentStatus } from '../../lib/rentPayments';

const leaseWorkflowZhTW = {
  awaiting_platform_1: '待平台審核（一審）',
  awaiting_landlord: '待業主確認',
  awaiting_platform_2: '待平台複審',
  approved: '已核准',
  rejected: '已拒絕',
  ended_early: '提早結束',
  ended_breach: '違約結束',
  paymentCard: '信用卡／扣賬卡',
  paymentFps: '轉數快 (FPS)',
  paymentBank: '銀行轉賬',
  paymentSucceeded: '租客已付款',
  paymentPendingBank: '租客已提交付款（待平台核對）',
  paymentFailed: '付款失敗',
  paymentNone: '尚未付款',
  rentPending: '待繳',
  rentPendingBank: '待入數核對',
  rentPaid: '已支付',
  rentOverdue: '逾期',
} as const;

export type LeaseWorkflowMessages = typeof leaseWorkflowZhTW;

const leaseWorkflowZhCN: LeaseWorkflowMessages = {
  awaiting_platform_1: '待平台审核（一审）',
  awaiting_landlord: '待业主确认',
  awaiting_platform_2: '待平台复审',
  approved: '已核准',
  rejected: '已拒绝',
  ended_early: '提早结束',
  ended_breach: '违约结束',
  paymentCard: '信用卡／扣账卡',
  paymentFps: '转数快 (FPS)',
  paymentBank: '银行转账',
  paymentSucceeded: '租客已付款',
  paymentPendingBank: '租客已提交付款（待平台核对）',
  paymentFailed: '付款失败',
  paymentNone: '尚未付款',
  rentPending: '待缴',
  rentPendingBank: '待入数核对',
  rentPaid: '已支付',
  rentOverdue: '逾期',
};

const leaseWorkflowEn: LeaseWorkflowMessages = {
  awaiting_platform_1: 'Platform review (1st)',
  awaiting_landlord: 'Pending Landlord',
  awaiting_platform_2: 'Platform review (final)',
  approved: 'Approved',
  rejected: 'Rejected',
  ended_early: 'Ended Early',
  ended_breach: 'Ended (breach)',
  paymentCard: 'Credit / Debit Card',
  paymentFps: 'FPS',
  paymentBank: 'Bank Transfer',
  paymentSucceeded: 'Tenant paid',
  paymentPendingBank: 'Payment submitted (pending verification)',
  paymentFailed: 'Payment Failed',
  paymentNone: 'Not Paid Yet',
  rentPending: 'Due',
  rentPendingBank: 'Pending Transfer Verification',
  rentPaid: 'Paid',
  rentOverdue: 'Overdue',
};

export const leaseWorkflowMessages: Record<AppLocale, LeaseWorkflowMessages> = {
  'zh-TW': leaseWorkflowZhTW,
  'zh-CN': leaseWorkflowZhCN,
  en: leaseWorkflowEn,
};

export function buildLeaseWorkflowT(locale: AppLocale) {
  const messages = leaseWorkflowMessages[locale];
  return {
    ...messages,
    format(key: keyof LeaseWorkflowMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    workflowStatus(code: string) {
      const k = code as LeaseWorkflowStatus;
      return messages[k as keyof LeaseWorkflowMessages] ?? code;
    },
    paymentMethod(method: PaymentMethodCode | string | null | undefined) {
      switch (method) {
        case 'card':
          return messages.paymentCard;
        case 'fps':
          return messages.paymentFps;
        case 'bank_transfer':
          return messages.paymentBank;
        default:
          return method ? String(method) : '—';
      }
    },
    landlordPaymentStatus(status: string | null | undefined) {
      switch (status) {
        case 'succeeded':
          return messages.paymentSucceeded;
        case 'pending_bank':
          return messages.paymentPendingBank;
        case 'failed':
          return messages.paymentFailed;
        case null:
        case '':
        case undefined:
          return messages.paymentNone;
        default:
          return status;
      }
    },
    rentPaymentStatus(status: RentPaymentStatus | null | undefined) {
      switch (status) {
        case 'pending':
          return messages.rentPending;
        case 'pending_bank':
          return messages.rentPendingBank;
        case 'paid':
          return messages.rentPaid;
        case 'overdue':
          return messages.rentOverdue;
        default:
          return status ?? '';
      }
    },
  };
}
