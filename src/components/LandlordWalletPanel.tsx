import { useCallback, useEffect, useState } from 'react';
import { Loader2, Wallet, ArrowDownToLine, History } from 'lucide-react';
import { Button } from './ui/button';
import {
  fetchLandlordWalletBalance,
  fetchLandlordWalletLedger,
  fetchLandlordWithdrawalRequests,
  ledgerEntryLabel,
  submitLandlordWithdrawal,
  withdrawalStatusLabel,
  type WalletLedgerEntry,
  type WithdrawalRequest,
} from '../lib/landlordWallet';

function formatHkd(n: number) {
  return `HK$${n.toLocaleString('zh-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function LandlordWalletPanel() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [amount, setAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'fps'>('bank_transfer');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fpsId, setFpsId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const [bal, led, wds] = await Promise.all([
      fetchLandlordWalletBalance(),
      fetchLandlordWalletLedger(),
      fetchLandlordWithdrawalRequests(),
    ]);
    setBalance(bal);
    setLedger(led);
    setWithdrawals(wds);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmitWithdrawal() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErr('請輸入有效提現金額');
      return;
    }
    if (parsed > balance) {
      setErr('提現金額不可超過可用餘額');
      return;
    }
    setSubmitting(true);
    setErr('');
    setOkMsg('');
    try {
      await submitLandlordWithdrawal({
        amount: parsed,
        payoutMethod,
        bankName,
        accountHolder,
        accountNumber,
        fpsId,
      });
      setOkMsg('提現申請已提交，平台審核後會轉帳至你指定的帳戶。');
      setAmount('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失敗');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        載入錢包…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-700 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Wallet className="h-4 w-4" aria-hidden />
          可用餘額
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{formatHkd(balance)}</p>
      </section>

      {err ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      ) : null}
      {okMsg ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {okMsg}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <ArrowDownToLine className="h-4 w-4" aria-hidden />
          申請提現
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="withdraw-amount" className="block text-xs text-gray-500">
              金額（HK$）
            </label>
            <input
              id="withdraw-amount"
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`最多 ${balance.toLocaleString()}`}
            />
          </div>
          <div>
            <span className="block text-xs text-gray-500">收款方式</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  payoutMethod === 'bank_transfer'
                    ? 'bg-black text-white ring-black'
                    : 'bg-white text-gray-700 ring-gray-300'
                }`}
                onClick={() => setPayoutMethod('bank_transfer')}
              >
                銀行轉帳
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  payoutMethod === 'fps' ? 'bg-black text-white ring-black' : 'bg-white text-gray-700 ring-gray-300'
                }`}
                onClick={() => setPayoutMethod('fps')}
              >
                轉數快 FPS
              </button>
            </div>
          </div>
          {payoutMethod === 'bank_transfer' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="bank-name" className="block text-xs text-gray-500">
                  銀行名稱
                </label>
                <input
                  id="bank-name"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="account-holder" className="block text-xs text-gray-500">
                  戶口持有人
                </label>
                <input
                  id="account-holder"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="account-number" className="block text-xs text-gray-500">
                  戶口號碼
                </label>
                <input
                  id="account-number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="fps-id" className="block text-xs text-gray-500">
                轉數快識別碼（電話／電郵／FPS ID）
              </label>
              <input
                id="fps-id"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={fpsId}
                onChange={(e) => setFpsId(e.target.value)}
              />
            </div>
          )}
          <Button
            type="button"
            className="w-full bg-black text-white hover:bg-gray-800 sm:w-auto"
            disabled={submitting || balance <= 0}
            onClick={() => void handleSubmitWithdrawal()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                提交中…
              </>
            ) : (
              '提交提現申請'
            )}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <History className="h-4 w-4" aria-hidden />
          入帳與提現紀錄
        </h2>
        {ledger.length === 0 && withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">尚無紀錄。待平台轉交租金後會顯示入帳明細。</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{ledgerEntryLabel(entry)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.createdAt).toLocaleString('zh-HK')}
                  </p>
                </div>
                <span className={`shrink-0 font-medium ${entry.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {entry.amount >= 0 ? '+' : ''}
                  {formatHkd(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {withdrawals.length > 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">提現申請</h2>
          <ul className="mt-3 space-y-3">
            {withdrawals.map((w) => (
              <li key={w.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{formatHkd(w.amount)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-gray-200">
                    {withdrawalStatusLabel(w.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(w.createdAt).toLocaleString('zh-HK')}
                  {w.payoutMethod === 'fps' ? ` · FPS：${w.fpsId}` : ` · ${w.bankName} ${w.accountNumber}`}
                </p>
                {w.adminNotes ? <p className="mt-1 text-xs text-gray-600">備註：{w.adminNotes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
