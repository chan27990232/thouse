import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type WithdrawalRow = {
  id: string;
  created_at: string;
  status: string;
  amount: number;
  payout_method: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  fps_id: string;
  admin_notes: string;
  reviewed_at: string | null;
  landlord_id: string;
  landlord:
    | { full_name: string | null; email: string | null; phone: string | null }
    | { full_name: string | null; email: string | null; phone: string | null }[]
    | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待審核',
  processing: '處理中',
  paid: '已出款',
  rejected: '已駁回',
};

function landlordOf(r: WithdrawalRow) {
  const p = r.landlord;
  if (Array.isArray(p)) return p[0];
  return p;
}

export function LandlordWithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data, error } = await supabase
      .from('landlord_withdrawal_requests')
      .select(
        `
        id, created_at, status, amount, payout_method,
        bank_name, account_holder, account_number, fps_id,
        admin_notes, reviewed_at, landlord_id,
        landlord:profiles!landlord_withdrawal_requests_landlord_id_fkey ( full_name, email, phone )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as WithdrawalRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function processRequest(id: string, action: 'processing' | 'paid' | 'rejected') {
    setActionId(id);
    setErr('');
    const { error } = await supabase.rpc('admin_process_landlord_withdrawal', {
      p_request_id: id,
      p_action: action,
      p_admin_notes: notesDraft[id]?.trim() ?? '',
    });
    setActionId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-50 sm:text-2xl">業主提現申請</h1>
        <p className="mt-1 text-sm text-slate-400">
          業主錢包餘額來自「公司轉業主」標為已轉交之租金與水電煤。核准提現後請線下轉帳，再標記為已出款。
        </p>
      </header>

      {err ? (
        <div role="alert" className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">載入中…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">暫無提現申請。</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const landlord = landlordOf(r);
            const open = r.status === 'pending' || r.status === 'processing';
            return (
              <li
                key={r.id}
                className="rounded-xl border border-slate-700/80 bg-[#161b22] p-4 text-sm text-slate-200 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-50">
                      HK${Number(r.amount).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleString('zh-HK')}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs ring-1 ring-slate-600">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>

                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">業主</dt>
                    <dd>
                      {landlord?.full_name?.trim() || '—'}
                      {landlord?.email ? ` · ${landlord.email}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">收款方式</dt>
                    <dd>{r.payout_method === 'fps' ? '轉數快 FPS' : '銀行轉帳'}</dd>
                  </div>
                  {r.payout_method === 'fps' ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">FPS 識別碼</dt>
                      <dd className="font-mono text-xs">{r.fps_id}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt className="text-xs text-slate-500">銀行</dt>
                        <dd>{r.bank_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">戶口持有人</dt>
                        <dd>{r.account_holder}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">戶口號碼</dt>
                        <dd className="font-mono text-xs">{r.account_number}</dd>
                      </div>
                    </>
                  )}
                </dl>

                {open ? (
                  <div className="mt-4 space-y-3 border-t border-slate-700/60 pt-4">
                    <label className="block text-xs text-slate-500">
                      管理員備註（選填）
                      <textarea
                        rows={2}
                        className="mt-1 block w-full rounded-lg border border-slate-600 bg-[#0d1117] px-3 py-2 text-sm text-slate-100"
                        value={notesDraft[r.id] ?? r.admin_notes ?? ''}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'pending' ? (
                        <button
                          type="button"
                          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                          disabled={actionId !== null}
                          onClick={() => void processRequest(r.id, 'processing')}
                        >
                          {actionId === r.id ? '處理中…' : '標記處理中'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                        disabled={actionId !== null}
                        onClick={() => void processRequest(r.id, 'paid')}
                      >
                        {actionId === r.id ? '處理中…' : '已出款'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                        disabled={actionId !== null}
                        onClick={() => void processRequest(r.id, 'rejected')}
                      >
                        {actionId === r.id ? '處理中…' : '駁回並退回餘額'}
                      </button>
                    </div>
                  </div>
                ) : r.admin_notes ? (
                  <p className="mt-3 border-t border-slate-700/60 pt-3 text-xs text-slate-400">備註：{r.admin_notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
