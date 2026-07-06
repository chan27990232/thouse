import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';
import type { UtilityBillType } from '../../lib/propertyUtilityBills';

const utilityBillZhTW = {
  title: '上傳每月水電煤單',
  propertyLabel: '物業：',
  description: '請選擇帳單類型並上傳該月份帳單（可分多個 PDF 或清晰相片，每月最多 {max} 個）。',
  billMonth: '帳單月份',
  billType: '上傳帳單類型',
  tenantPayable: '應付水電煤',
  tenantPayablePlaceholder: '例如 350.50',
  tenantPayableHint: '填寫此類帳單的租客應付金額。上傳後由平台審核，通過後租客方可繳付。',
  filesLabel: '檔案（最多 {max} 個）',
  filesHint: 'PDF 或常見圖片格式，最多 {max} 個檔案、總大小 500MB 以內。',
  fileSummary: '共 {count} 個 · {size} / {maxSize}',
  removeFile: '移除檔案',
  uploading: '上傳中…',
  confirmUpload: '確認上傳（{count}）',
  cancel: '取消',
  water: '水費',
  waterHint: '水務署或管理處水費單',
  electricity: '電費',
  electricityHint: '中電／港燈等電費單',
  gas: '煤氣費',
  gasHint: '煤氣公司帳單',
  errNoSupabase: '未設定 Supabase，無法上傳。',
  errMonthFormat: '月份格式不正確。',
  errLogin: '請先登入。',
  errPayableRequired: '請填寫應付水電煤',
  errPayablePositive: '應付水電煤請填寫大於 0 的金額',
  uploadSuccess: '已上傳 {count} 個水電煤單檔案，待平台審核後租客方可繳付。',
  uploadFailed: '上傳失敗，請稍後再試。',
  valNoFiles: '請選擇至少一個檔案',
  valTooMany: '每次最多上傳 {max} 個檔案',
  valMonthLimit: '此月份已有 {existing} 個檔案，最多共 {max} 個',
  valFileTooBig: '所選檔案總大小請在 500MB 以內',
  valInvalidType: '檔案不能為空',
} as const;

export type UtilityBillMessages = typeof utilityBillZhTW;

const utilityBillZhCN: UtilityBillMessages = {
  title: '上传每月水电煤单',
  propertyLabel: '物业：',
  description: '请选择帐单类型并上传该月份帐单（可分多个 PDF 或清晰相片，每月最多 {max} 个）。',
  billMonth: '帐单月份',
  billType: '上传帐单类型',
  tenantPayable: '应付水电煤',
  tenantPayablePlaceholder: '例如 350.50',
  tenantPayableHint: '填写此类帐单的租客应付金额。上传后由平台审核，通过后租客方可缴付。',
  filesLabel: '档案（最多 {max} 个）',
  filesHint: 'PDF 或常见图片格式，最多 {max} 个档案、总大小 500MB 以内。',
  fileSummary: '共 {count} 个 · {size} / {maxSize}',
  removeFile: '移除档案',
  uploading: '上传中…',
  confirmUpload: '确认上传（{count}）',
  cancel: '取消',
  water: '水费',
  waterHint: '水务署或管理处水费单',
  electricity: '电费',
  electricityHint: '中电／港灯等电费单',
  gas: '煤气费',
  gasHint: '煤气公司帐单',
  errNoSupabase: '未设定 Supabase，无法上传。',
  errMonthFormat: '月份格式不正确。',
  errLogin: '请先登入。',
  errPayableRequired: '请填写应付水电煤',
  errPayablePositive: '应付水电煤请填写大于 0 的金额',
  uploadSuccess: '已上传 {count} 个水电煤单档案，待平台审核后租客方可缴付。',
  uploadFailed: '上传失败，请稍后再试。',
  valNoFiles: '请选择至少一个档案',
  valTooMany: '每次最多上传 {max} 个档案',
  valMonthLimit: '此月份已有 {existing} 个档案，最多共 {max} 个',
  valFileTooBig: '所选档案总大小请在 500MB 以内',
  valInvalidType: '档案不能为空',
};

const utilityBillEn: UtilityBillMessages = {
  title: 'Upload Monthly Utility Bills',
  propertyLabel: 'Listing: ',
  description:
    'Choose bill type and upload files for this month (multiple PDFs or clear photos, up to {max} per month).',
  billMonth: 'Bill Month',
  billType: 'Bill Type',
  tenantPayable: 'Tenant Payable Amount',
  tenantPayablePlaceholder: 'e.g. 350.50',
  tenantPayableHint:
    'Amount the tenant should pay for this bill type. After upload, platform review is required before the tenant can pay.',
  filesLabel: 'Files (max {max})',
  filesHint: 'PDF or common image formats, up to {max} files and 500MB total.',
  fileSummary: '{count} file(s) · {size} / {maxSize}',
  removeFile: 'Remove File',
  uploading: 'Uploading…',
  confirmUpload: 'Confirm Upload ({count})',
  cancel: 'Cancel',
  water: 'Water',
  waterHint: 'Waterworks or management office bill',
  electricity: 'Electricity',
  electricityHint: 'CLP / HK Electric etc.',
  gas: 'Gas',
  gasHint: 'Towngas or other gas company bill',
  errNoSupabase: 'Supabase is not configured; upload unavailable.',
  errMonthFormat: 'Invalid month format.',
  errLogin: 'Please sign in first.',
  errPayableRequired: 'Please enter the tenant payable amount',
  errPayablePositive: 'Tenant Payable Amount must be greater than 0',
  uploadSuccess:
    'Uploaded {count} utility bill file(s). Tenants can pay after platform review.',
  uploadFailed: 'Upload failed. Please try again later.',
  valNoFiles: 'Please select at least one file',
  valTooMany: 'You can upload at most {max} files at a time',
  valMonthLimit: 'This month already has {existing} file(s); maximum {max} total',
  valFileTooBig: 'Total file size must be within 500MB',
  valInvalidType: 'File cannot be empty',
};

export const utilityBillMessages: Record<AppLocale, UtilityBillMessages> = {
  'zh-TW': utilityBillZhTW,
  'zh-CN': utilityBillZhCN,
  en: utilityBillEn,
};

export function buildUtilityBillT(locale: AppLocale) {
  const messages = utilityBillMessages[locale];
  return {
    ...messages,
    format(key: keyof UtilityBillMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    billTypeLabel(type: UtilityBillType) {
      switch (type) {
        case 'water':
          return messages.water;
        case 'electricity':
          return messages.electricity;
        case 'gas':
          return messages.gas;
        default:
          return type;
      }
    },
    billTypeHint(type: UtilityBillType) {
      switch (type) {
        case 'water':
          return messages.waterHint;
        case 'electricity':
          return messages.electricityHint;
        case 'gas':
          return messages.gasHint;
        default:
          return '';
      }
    },
  };
}
