export const SALUTATION_PREFER_NOT = '不便透露' as const;

export type AppSalutation = '' | '先生' | '女士' | typeof SALUTATION_PREFER_NOT;

export function normalizeSalutation(value: unknown): AppSalutation {
  if (value === '先生' || value === '女士' || value === SALUTATION_PREFER_NOT) {
    return value;
  }
  return '';
}

/** 用於顯示在姓名前的稱謂（不便透露不顯示） */
export function salutationForDisplayName(value: unknown): '' | '先生' | '女士' {
  if (value === '先生' || value === '女士') return value;
  return '';
}
