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

/** 信用卡號 Luhn 校驗（13–19 位） */
export function luhnValid(digits: string): boolean {
  const s = digits.replace(/\D/g, '');
  if (s.length < 13 || s.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * 到期日 MM/YY 是否已過期（以該月最後一日 23:59:59 為準）
 */
export function isCardExpiryInPast(mmYy: string): boolean {
  const t = mmYy.replace(/\D/g, '');
  if (t.length < 4) return true;
  const mm = parseInt(t.slice(0, 2), 10);
  const yy = parseInt(t.slice(2, 4), 10);
  if (mm < 1 || mm > 12) return true;
  const year = 2000 + yy;
  const last = new Date(year, mm, 0, 23, 59, 59, 999);
  return last < new Date();
}

export function formatCardPanForDisplay(pan: string): string {
  const d = pan.replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export type PaymentMethodCode = 'card' | 'fps' | 'bank_transfer';

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
