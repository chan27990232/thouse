import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const landlordWalletZhTW = {
  loadingWallet: '載入錢包…',
  availableBalance: '可用餘額',
  requestWithdrawal: '申請提現',
  amountHkd: '金額（HK$）',
  maxPlaceholder: '最多 {max}',
  payoutMethod: '收款方式',
  bankTransfer: '銀行轉帳',
  fps: '轉數快 FPS',
  bankName: '銀行名稱',
  accountHolder: '戶口持有人',
  accountNumber: '戶口號碼',
  fpsIdLabel: '轉數快識別碼（電話／電郵／FPS ID）',
  submitting: '提交中…',
  submitWithdrawal: '提交提現申請',
  ledgerTitle: '入帳與提現紀錄',
  ledgerEmpty: '尚無紀錄。待平台轉交租金後會顯示入帳明細。',
  withdrawalsTitle: '提現申請',
  adminNotes: '備註：',
  errInvalidAmount: '請輸入有效提現金額',
  errExceedsBalance: '提現金額不可超過可用餘額',
  okWithdrawalSubmitted: '提現申請已提交，平台審核後會轉帳至你指定的帳戶。',
  errSubmitFailed: '提交失敗',
  statusPending: '待審核',
  statusProcessing: '處理中',
  statusPaid: '已出款',
  statusRejected: '已駁回',
  ledgerLeaseInitial: '簽約首期租金入帳',
  ledgerRent: '月租入帳',
  ledgerUtility: '水電煤入帳',
  ledgerWithdrawalDebit: '提現扣款',
  ledgerWithdrawalRefund: '提現退回',
} as const;

export type LandlordWalletMessages = typeof landlordWalletZhTW;

const landlordWalletZhCN: LandlordWalletMessages = {
  loadingWallet: '载入钱包…',
  availableBalance: '可用余额',
  requestWithdrawal: '申请提现',
  amountHkd: '金额（HK$）',
  maxPlaceholder: '最多 {max}',
  payoutMethod: '收款方式',
  bankTransfer: '银行转账',
  fps: '转数快 FPS',
  bankName: '银行名称',
  accountHolder: '户口持有人',
  accountNumber: '户口号码',
  fpsIdLabel: '转数快识别码（电话／电邮／FPS ID）',
  submitting: '提交中…',
  submitWithdrawal: '提交提现申请',
  ledgerTitle: '入帐与提现纪录',
  ledgerEmpty: '尚无纪录。待平台转交租金后会显示入帐明细。',
  withdrawalsTitle: '提现申请',
  adminNotes: '备注：',
  errInvalidAmount: '请输入有效提现金额',
  errExceedsBalance: '提现金额不可超过可用余额',
  okWithdrawalSubmitted: '提现申请已提交，平台审核后会转帐至你指定的帐户。',
  errSubmitFailed: '提交失败',
  statusPending: '待审核',
  statusProcessing: '处理中',
  statusPaid: '已出款',
  statusRejected: '已驳回',
  ledgerLeaseInitial: '签约首期租金入帐',
  ledgerRent: '月租入帐',
  ledgerUtility: '水电煤入帐',
  ledgerWithdrawalDebit: '提现扣款',
  ledgerWithdrawalRefund: '提现退回',
};

const landlordWalletEn: LandlordWalletMessages = {
  loadingWallet: 'Loading wallet…',
  availableBalance: 'Available Balance',
  requestWithdrawal: 'Request Withdrawal',
  amountHkd: 'Amount (HK$)',
  maxPlaceholder: 'Max {max}',
  payoutMethod: 'Payout Method',
  bankTransfer: 'Bank Transfer',
  fps: 'FPS',
  bankName: 'Bank Name',
  accountHolder: 'Account Holder',
  accountNumber: 'Account Number',
  fpsIdLabel: 'FPS ID (phone / email / FPS ID)',
  submitting: 'Submitting…',
  submitWithdrawal: 'Submit Withdrawal Request',
  ledgerTitle: 'Credits & Withdrawals',
  ledgerEmpty: 'No records yet. Entries appear after the platform transfers rent to you.',
  withdrawalsTitle: 'Withdrawal Requests',
  adminNotes: 'Notes: ',
  errInvalidAmount: 'Please enter a valid withdrawal amount',
  errExceedsBalance: 'Amount cannot exceed available balance',
  okWithdrawalSubmitted:
    'Withdrawal request submitted. Funds will be transferred after platform review.',
  errSubmitFailed: 'Submission failed',
  statusPending: 'Pending Review',
  statusProcessing: 'Processing',
  statusPaid: 'Paid Out',
  statusRejected: 'Rejected',
  ledgerLeaseInitial: 'Initial Lease Payment Credited',
  ledgerRent: 'Monthly Rent Credited',
  ledgerUtility: 'Utilities Credited',
  ledgerWithdrawalDebit: 'Withdrawal Debit',
  ledgerWithdrawalRefund: 'Withdrawal Refund',
};

export const landlordWalletMessages: Record<AppLocale, LandlordWalletMessages> = {
  'zh-TW': landlordWalletZhTW,
  'zh-CN': landlordWalletZhCN,
  en: landlordWalletEn,
};

export function buildLandlordWalletT(locale: AppLocale) {
  const messages = landlordWalletMessages[locale];
  return {
    ...messages,
    format(key: keyof LandlordWalletMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    withdrawalStatusLabel(status: string) {
      switch (status) {
        case 'pending':
          return messages.statusPending;
        case 'processing':
          return messages.statusProcessing;
        case 'paid':
          return messages.statusPaid;
        case 'rejected':
          return messages.statusRejected;
        default:
          return status;
      }
    },
    ledgerSourceLabel(sourceType: string, amount?: number) {
      switch (sourceType) {
        case 'lease_initial':
          return messages.ledgerLeaseInitial;
        case 'rent':
          return messages.ledgerRent;
        case 'utility':
          return messages.ledgerUtility;
        case 'withdrawal':
          return amount !== undefined && amount < 0
            ? messages.ledgerWithdrawalDebit
            : messages.ledgerWithdrawalRefund;
        default:
          return sourceType;
      }
    },
  };
}
