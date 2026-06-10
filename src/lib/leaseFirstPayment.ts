/** 簽約首期：按金 2 個月 + 首月 1 個月 + 平台費 1%（全站單一來源） */

export interface LeaseFirstPaymentBreakdown {
  monthlyRent: number;
  /** 2 個月按金 */
  depositAmount: number;
  firstMonthRent: number;
  /** 三個月租金小計 */
  rentalSubtotal: number;
  platformFee: number;
  total: number;
}

export function getLeaseFirstPaymentBreakdown(monthlyRent: number): LeaseFirstPaymentBreakdown {
  const n = Math.max(0, Math.round(Number(monthlyRent) || 0));
  const depositAmount = n * 2;
  const firstMonthRent = n;
  const rentalSubtotal = n * 3;
  const platformFee = Math.round(rentalSubtotal * 0.01);
  return {
    monthlyRent: n,
    depositAmount,
    firstMonthRent,
    rentalSubtotal,
    platformFee,
    total: rentalSubtotal + platformFee,
  };
}

export function computeFirstPaymentTotal(monthlyRent: number): number {
  return getLeaseFirstPaymentBreakdown(monthlyRent).total;
}

/** 租客流程可選付款方式（與資料庫 payment_method 相容；historical rows 可能有 card） */
export type PaymentMethodCode = 'card' | 'fps' | 'bank_transfer';

export type LeasePaymentSubmitMethod = 'fps' | 'bank_transfer';

export function getPaymentMethodLabel(m: PaymentMethodCode): string {
  switch (m) {
    case 'card':
      return '信用卡／扣賬卡';
    case 'fps':
      return '轉數快 (FPS)';
    case 'bank_transfer':
      return '銀行轉賬';
    default:
      return m;
  }
}
