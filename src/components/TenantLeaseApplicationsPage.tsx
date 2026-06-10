import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Circle, ClipboardList, House, Loader2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { defaultPropertyImage } from '../lib/properties';
import {
  fetchLeaseApplicationsForTenant,
  getLeasePaymentStatusLabel,
  getLeaseWorkflowStatusLabel,
  type TenantLeaseApplicationSummary,
} from '../lib/leaseApplications';
import { getPaymentMethodLabel, type PaymentMethodCode } from '../lib/leaseFirstPayment';

interface TenantLeaseApplicationsPageProps {
  onBack: () => void;
}

type ProgressStep = { key: string; label: string; description: string };

const WORKFLOW_STEPS: ProgressStep[] = [
  { key: 'payment', label: '付款／入數', description: '完成首期付款或上傳轉賬證明，待平台核對入數。' },
  { key: 'awaiting_platform_1', label: '平台一審', description: '平台審核申請資料與付款紀錄。' },
  { key: 'awaiting_landlord', label: '業主確認', description: '業主檢視申請並決定是否接受。' },
  { key: 'awaiting_platform_2', label: '平台複審', description: '業主同意後，平台進行最終複審。' },
  { key: 'approved', label: '簽約完成', description: '申請已核准，租約正式成立。' },
];

function getActiveStepIndex(row: TenantLeaseApplicationSummary): number {
  if (row.applicationStatus === 'rejected') {
    return WORKFLOW_STEPS.findIndex((s) => s.key === 'awaiting_platform_1');
  }
  if (row.paymentStatus === 'pending_bank') return 0;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === row.applicationStatus);
  return idx >= 0 ? idx : 1;
}

function getStatusBadge(row: TenantLeaseApplicationSummary) {
  if (row.applicationStatus === 'approved') {
    return <Badge className="bg-green-600 hover:bg-green-600">已核准</Badge>;
  }
  if (row.applicationStatus === 'rejected') {
    return <Badge className="bg-red-600 hover:bg-red-600">已拒絕</Badge>;
  }
  if (row.paymentStatus === 'pending_bank') {
    return <Badge className="bg-orange-500 hover:bg-orange-500">待入數核對</Badge>;
  }
  return (
    <Badge className="bg-blue-600 hover:bg-blue-600">
      {getLeaseWorkflowStatusLabel(row.applicationStatus)}
    </Badge>
  );
}

function StepIndicator({
  step,
  index,
  activeIndex,
  isRejected,
}: {
  step: ProgressStep;
  index: number;
  activeIndex: number;
  isRejected: boolean;
}) {
  const isComplete = !isRejected && index < activeIndex;
  const isCurrent = !isRejected && index === activeIndex;
  const isFailed = isRejected && index === activeIndex;

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            isFailed
              ? 'border-red-500 bg-red-50 text-red-600'
              : isComplete
                ? 'border-green-600 bg-green-600 text-white'
                : isCurrent
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-400'
          }`}
        >
          {isFailed ? (
            <X className="h-3.5 w-3.5" />
          ) : isComplete ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Circle className="h-2 w-2 fill-current" />
          )}
        </div>
        {index < WORKFLOW_STEPS.length - 1 ? (
          <div className={`my-1 w-0.5 flex-1 min-h-[1.25rem] ${isComplete ? 'bg-green-600' : 'bg-gray-200'}`} />
        ) : null}
      </div>
      <div className={`pb-4 ${index === WORKFLOW_STEPS.length - 1 ? 'pb-0' : ''}`}>
        <p className={`text-sm font-medium ${isCurrent || isFailed ? 'text-gray-900' : isComplete ? 'text-gray-800' : 'text-gray-500'}`}>
          {step.label}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{step.description}</p>
      </div>
    </li>
  );
}

export function TenantLeaseApplicationsPage({ onBack }: TenantLeaseApplicationsPageProps) {
  const [rows, setRows] = useState<TenantLeaseApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await fetchLeaseApplicationsForTenant());
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入申請');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="返回">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-5 w-5 shrink-0 text-gray-700" />
            <h1 className="truncate text-lg font-semibold">我的租盤申請</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-gray-600 leading-relaxed">
          以下為你已提交的簽約申請與審批進度。已核准的租盤請至「我的租盤」查看與繳費。
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            載入中…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <House className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-800">暫無租盤申請</p>
          </div>
        ) : (
          rows.map((row) => {
            const activeIndex = getActiveStepIndex(row);
            const isRejected = row.applicationStatus === 'rejected';
            const payMethod = row.paymentMethod
              ? getPaymentMethodLabel(row.paymentMethod as PaymentMethodCode)
              : '—';

            return (
              <Card key={row.id} className="overflow-hidden">
                <div className="flex gap-3 border-b p-4">
                  <ImageWithFallback
                    src={row.propertyImage || defaultPropertyImage}
                    alt={row.propertyTitle}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold leading-snug">{row.propertyTitle}</h2>
                      {getStatusBadge(row)}
                    </div>
                    <p className="text-base font-semibold">
                      HK${row.firstPaymentTotal.toLocaleString()}
                      <span className="ml-1 text-xs font-normal text-gray-500">首期總額</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-gray-500">擬入住日期</dt>
                      <dd>
                        {row.moveInDate
                          ? new Date(row.moveInDate + 'T12:00:00').toLocaleDateString('zh-HK')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">租期</dt>
                      <dd>{row.leaseMonths} 個月</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">付款方式</dt>
                      <dd>{payMethod}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">付款狀態</dt>
                      <dd>{getLeasePaymentStatusLabel(row.paymentStatus)}</dd>
                    </div>
                  </dl>
                  {isRejected ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      此申請已被拒絕。如有疑問，可透過站內訊息或聯絡客服查詢。
                    </div>
                  ) : null}
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">審批進度</h3>
                    <ol>
                      {WORKFLOW_STEPS.map((step, index) => (
                        <StepIndicator
                          key={step.key}
                          step={step}
                          index={index}
                          activeIndex={activeIndex}
                          isRejected={isRejected}
                        />
                      ))}
                    </ol>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
