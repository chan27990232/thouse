import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  fetchPendingLeasesToReview,
  fetchReviewsReceivedByMe,
  getProfileStarSummary,
  submitTransactionReview,
  type PendingLeaseForReview,
  type ReceivedReview,
} from '../lib/transactionReviews';
import { supabase } from '../lib/supabase';

function StarRow({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="p-0.5 rounded disabled:opacity-50"
          aria-label={`${n} 星`}
        >
          <Star
            className={`w-7 h-7 ${n <= value ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
          />
        </button>
      ))}
      <span className="text-sm text-gray-600 ml-1">{value} / 5</span>
    </div>
  );
}

function PendingCard({
  item,
  onDone,
}: {
  item: PendingLeaseForReview;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    if (stars < 1) {
      setErr('請點選星等（1–5 星，5 星為滿分）');
      return;
    }
    setErr('');
    setSaving(true);
    try {
      await submitTransactionReview({
        leaseApplicationId: item.leaseApplicationId,
        toUserId: item.toUserId,
        stars,
        comment,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-gray-50/80">
      <div className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{item.propertyTitle}</span>
        <span className="mx-1">·</span>
        評價{item.otherRoleLabel}：{item.otherPartyName}
      </div>
      <div>
        <Label className="text-xs text-gray-500">星等</Label>
        <div className="mt-1">
          <StarRow value={stars} onChange={setStars} disabled={saving} />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-500">意見（選填）</Label>
        <Textarea
          className="mt-1 min-h-[72px] bg-white"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="實際完成交易後的心得…"
          disabled={saving}
        />
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <Button
        className="w-full bg-black text-white hover:bg-gray-800"
        onClick={() => void handleSubmit()}
        disabled={saving}
      >
        {saving ? '提交中…' : '提交評價'}
      </Button>
    </div>
  );
}

export function TransactionReviewPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ avg: number; count: number } | null>(null);
  const [pending, setPending] = useState<PendingLeaseForReview[]>([]);
  const [received, setReceived] = useState<ReceivedReview[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (uid: string) => {
    setLoadErr('');
    try {
      const [s, p, r] = await Promise.all([
        getProfileStarSummary(uid).catch((e) => {
          if (e instanceof Error && e.message.includes('尚未套用')) throw e;
          return { avgStars: 0, reviewCount: 0 };
        }),
        fetchPendingLeasesToReview().catch((e) => {
          if (e instanceof Error && e.message.includes('尚未套用')) throw e;
          return [];
        }),
        fetchReviewsReceivedByMe().catch(() => [] as ReceivedReview[]),
      ]);
      setSummary({ avg: s.avgStars, count: s.reviewCount });
      setPending(p);
      setReceived(r);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '無法載入評價資料');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setUserId(null);
        setLoading(false);
        return;
      }
      setUserId(user.id);
      await refresh(user.id);
      setLoading(false);
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 text-sm text-gray-500 text-center">載入交易評價…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">交易評價</h2>
        <p className="text-sm text-gray-600 mt-1">簽約申請已核准後，可為對方留 1–5 星評價（5 星為滿分）。</p>
      </div>

      {loadErr ? <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">{loadErr}</p> : null}

      {summary && (
        <div className="rounded-lg border p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">我獲得的平均星等</p>
            <p className="text-2xl font-semibold mt-1">
              {summary.count === 0 ? '—' : summary.avg.toFixed(2)}
              <span className="text-sm font-normal text-gray-500 ml-2">/ 5</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">共 {summary.count} 筆實際交易評價</p>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-6 h-6 ${summary.count > 0 && n <= Math.round(summary.avg) ? 'fill-amber-400 text-amber-500' : 'text-gray-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800">待評價的核准簽約</h3>
          {pending.map((item) => (
            <PendingCard
              key={item.leaseApplicationId}
              item={item}
              onDone={() => {
                if (userId) void refresh(userId);
              }}
            />
          ))}
        </div>
      )}

      {received.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">他人留給我的評價</h3>
          <ul className="space-y-2">
            {received.map((r) => (
              <li key={r.id} className="rounded-lg border p-3 text-sm bg-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-700 font-medium">
                    {r.fromRole === 'tenant' ? '租客' : '業主'} · {r.fromNameHint}
                  </span>
                  <span className="text-amber-600 shrink-0">{r.stars} / 5 星</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{r.propertyTitle}</p>
                {r.comment ? <p className="text-gray-600 mt-2 leading-relaxed">{r.comment}</p> : null}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(r.createdAt).toLocaleString('zh-HK', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length === 0 && received.length === 0 && !loadErr && (summary?.count ?? 0) === 0 && (
        <p className="text-sm text-gray-500">尚無可顯示的核准簽約或評價；核准通過簽約後可於此留評。</p>
      )}
    </div>
  );
}
