import { useCallback, useEffect, useState } from 'react';
import { Loader2, Wallet, ArrowDownToLine, History } from 'lucide-react';
import { Button } from './ui/button';
import {
  fetchLandlordWalletBalance,
  fetchLandlordCumulativeProfit,
  fetchLandlordWalletLedger,
  fetchLandlordWithdrawalRequests,
  submitLandlordWithdrawal,
  type WalletLedgerEntry,
  type WithdrawalRequest,
} from '../lib/landlordWallet';
import { useLocale } from '../context/LocaleContext';
import { LOCALE_DATE_LOCALE } from '../lib/locale';

function formatHkd(n: number) {
  return `HK$${n.toLocaleString('zh-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function LandlordWalletPanel() {
  const { locale, landlordWalletT: t } = useLocale();
  const [balance, setBalance] = useState(0);
  const [cumulativeProfit, setCumulativeProfit] = useState(0);
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
    const [bal, profit, led, wds] = await Promise.all([
      fetchLandlordWalletBalance(),
      fetchLandlordCumulativeProfit(),
      fetchLandlordWalletLedger(),
      fetchLandlordWithdrawalRequests(),
    ]);
    setBalance(bal);
    setCumulativeProfit(profit);
    setLedger(led);
    setWithdrawals(wds);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ledgerLabel = (entry: WalletLedgerEntry) => {
    if (entry.description.trim()) return entry.description;
    return t.ledgerSourceLabel(entry.sourceType, entry.amount);
  };

  async function handleSubmitWithdrawal() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErr(t.errInvalidAmount);
      return;
    }
    if (parsed > balance) {
      setErr(t.errExceedsBalance);
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
      setOkMsg(t.okWithdrawalSubmitted);
      setAmount('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errSubmitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        {t.loadingWallet}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-700 p-5 text-white shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              {t.availableBalance}
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{formatHkd(balance)}</p>
          </div>
          <div className="min-w-0 border-l border-white/15 pl-4">
            <p className="text-sm text-gray-300">{t.cumulativeProfit}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-100 sm:text-3xl">
              {formatHkd(cumulativeProfit)}
            </p>
          </div>
        </div>
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
          {t.requestWithdrawal}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="withdraw-amount" className="block text-xs text-gray-500">
              {t.amountHkd}
            </label>
            <input
              id="withdraw-amount"
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.format('maxPlaceholder', { max: balance.toLocaleString() })}
            />
          </div>
          <div>
            <span className="block text-xs text-gray-500">{t.payoutMethod}</span>
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
                {t.bankTransfer}
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  payoutMethod === 'fps' ? 'bg-black text-white ring-black' : 'bg-white text-gray-700 ring-gray-300'
                }`}
                onClick={() => setPayoutMethod('fps')}
              >
                {t.fps}
              </button>
            </div>
          </div>
          {payoutMethod === 'bank_transfer' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="bank-name" className="block text-xs text-gray-500">
                  {t.bankName}
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
                  {t.accountHolder}
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
                  {t.accountNumber}
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
                {t.fpsIdLabel}
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
                {t.submitting}
              </>
            ) : (
              t.submitWithdrawal
            )}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <History className="h-4 w-4" aria-hidden />
          {t.ledgerTitle}
        </h2>
        {ledger.length === 0 && withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t.ledgerEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{ledgerLabel(entry)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.createdAt).toLocaleString(LOCALE_DATE_LOCALE[locale])}
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
          <h2 className="text-base font-semibold text-gray-900">{t.withdrawalsTitle}</h2>
          <ul className="mt-3 space-y-3">
            {withdrawals.map((w) => (
              <li key={w.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{formatHkd(w.amount)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-gray-200">
                    {t.withdrawalStatusLabel(w.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(w.createdAt).toLocaleString(LOCALE_DATE_LOCALE[locale])}
                  {w.payoutMethod === 'fps' ? ` · FPS：${w.fpsId}` : ` · ${w.bankName} ${w.accountNumber}`}
                </p>
                {w.adminNotes ? <p className="mt-1 text-xs text-gray-600">{t.adminNotes}{w.adminNotes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
