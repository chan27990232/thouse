import { useState, type ReactNode } from 'react';
import {
  type UtilityRecord,
  getUtilityMonthLatestAt,
  getUtilityMonthPayable,
  truncateFilename,
  utilityBillTypeLabel,
  utilityMonthHighlightClass,
  resolveUtilityMonthReviewStatus,
  utilityReviewStatusLabel,
} from '../lib/propertyRecords';
import { downloadFromUrl, safeDownloadFilename } from '../lib/downloadFile';

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

function ReviewBadge({ status }: { status: string }) {
  const label = utilityReviewStatusLabel(status);
  if (status === 'approved') {
    return <span className="utility-review-badge utility-review-badge--approved">{label}</span>;
  }
  if (status === 'rejected') {
    return <span className="utility-review-badge utility-review-badge--rejected">{label}</span>;
  }
  return <span className="utility-review-badge utility-review-badge--pending">{label}</span>;
}

function RecordSummary({
  nextLabel,
  nextContent,
  lastLabel,
  lastContent,
}: {
  nextLabel: string;
  nextContent: ReactNode;
  lastLabel: string;
  lastContent: ReactNode;
}) {
  return (
    <div className="record-summary-row">
      <div className="record-summary-box record-summary-box--next">
        <div className="record-summary-label">{nextLabel}</div>
        {nextContent}
      </div>
      <div className="record-summary-box record-summary-box--last">
        <div className="record-summary-label">{lastLabel}</div>
        {lastContent}
      </div>
    </div>
  );
}

type Props = {
  monthGroups: [string, UtilityRecord[]][];
  utilityUrls: Record<string, string>;
  nextUploadMonth: string | null;
  lastUploadMonth: string | null;
  pendingReviewMonths: string[];
  reviewingMonth: string | null;
  onReview: (month: string, approve: boolean) => void;
};

export function PropertyUtilityBillsBlock({
  monthGroups,
  utilityUrls,
  nextUploadMonth,
  lastUploadMonth,
  pendingReviewMonths,
  reviewingMonth,
  onReview,
}: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);

  async function handleDownloadFile(file: UtilityRecord) {
    const url = utilityUrls[file.id];
    if (!url) return;
    setDownloadingId(file.id);
    try {
      await downloadFromUrl(url, safeDownloadFilename(file.original_filename, `utility-${file.id}`));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '下載失敗');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadMonth(month: string, files: UtilityRecord[]) {
    const withUrl = files.filter((f) => utilityUrls[f.id]);
    if (withUrl.length === 0) return;
    setDownloadingMonth(month);
    try {
      for (let i = 0; i < withUrl.length; i++) {
        const f = withUrl[i];
        await downloadFromUrl(
          utilityUrls[f.id],
          safeDownloadFilename(f.original_filename, `${month}-utility-${i + 1}`)
        );
        if (i < withUrl.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '下載失敗');
    } finally {
      setDownloadingMonth(null);
    }
  }

  const lastGroup = monthGroups[0];
  const lastFiles = lastGroup?.[1] ?? [];
  const lastMonth = lastGroup?.[0] ?? null;
  const lastLatestAt = getUtilityMonthLatestAt(lastFiles);

  return (
    <>
      <RecordSummary
        nextLabel="最近要交"
        nextContent={
          nextUploadMonth ? (
            <>
              <strong>{nextUploadMonth}</strong>
              <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
                業主應上傳此月水電煤單
              </div>
            </>
          ) : (
            <span className="record-summary-empty">—</span>
          )
        }
        lastLabel="上次最新已交"
        lastContent={
          lastMonth && lastFiles.length > 0 ? (
            <>
              <strong>{lastMonth}</strong>
              <div>{lastFiles.length} 個檔案</div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                {fmt(lastLatestAt)}
              </div>
            </>
          ) : (
            <span className="record-summary-empty">尚無上傳紀錄</span>
          )
        }
      />

      {pendingReviewMonths.length > 0 ? (
        <div className="utility-pending-banner">
          待審核 <strong>{pendingReviewMonths.length}</strong> 個月份：
          {pendingReviewMonths.join('、')}
        </div>
      ) : null}

      {monthGroups.length === 0 ? (
        <p className="muted utility-month-empty">此租盤尚無水電煤上傳紀錄</p>
      ) : (
        <div className="utility-month-list">
          {monthGroups.map(([month, files]) => {
            const reviewStatus = resolveUtilityMonthReviewStatus(files);
            const isPending = reviewStatus === 'pending_review';
            const payable = getUtilityMonthPayable(files);
            const latestAt = getUtilityMonthLatestAt(files);
            const highlight = utilityMonthHighlightClass(month, nextUploadMonth, lastUploadMonth);
            const canApprove = payable != null && payable > 0;

            return (
              <article key={month} className={`utility-month-card ${highlight}`.trim()}>
                <header className="utility-month-card__head">
                  <div className="utility-month-card__meta">
                    <h3 className="utility-month-card__title">{month}</h3>
                    <ReviewBadge status={reviewStatus} />
                  </div>
                  <div className="utility-month-card__amount">
                    <span className="muted" style={{ fontSize: '0.72rem' }}>
                      應付水電煤
                    </span>
                    <strong>
                      {payable != null
                        ? `HK$${payable.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}`
                        : '未填寫'}
                    </strong>
                  </div>
                </header>

                <div className="utility-month-card__files">
                  <div className="utility-month-card__files-head">
                    <span>帳單檔案（{files.length}）</span>
                    <div className="utility-month-card__files-actions">
                      <span className="muted">上傳 {fmt(latestAt)}</span>
                      {files.some((f) => utilityUrls[f.id]) ? (
                        <button
                          type="button"
                          className="utility-file-item__link utility-file-item__link--btn"
                          disabled={downloadingMonth === month}
                          onClick={() => void handleDownloadMonth(month, files)}
                        >
                          {downloadingMonth === month ? '下載中…' : '下載全部'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <ul className="utility-file-list">
                    {files.map((f) => (
                      <li key={f.id} className="utility-file-item">
                        <span className="utility-file-item__name" title={f.original_filename ?? undefined}>
                          {f.bill_type ? (
                            <span className="utility-file-type-tag">{utilityBillTypeLabel(f.bill_type)}</span>
                          ) : null}
                          {truncateFilename(f.original_filename)}
                        </span>
                        {utilityUrls[f.id] ? (
                          <span className="utility-file-item__actions">
                            <a
                              href={utilityUrls[f.id]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="utility-file-item__link"
                            >
                              查看
                            </a>
                            <button
                              type="button"
                              className="utility-file-item__link utility-file-item__link--btn"
                              disabled={downloadingId === f.id}
                              onClick={() => void handleDownloadFile(f)}
                            >
                              {downloadingId === f.id ? '下載中…' : '下載'}
                            </button>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <footer className="utility-month-card__foot">
                  {isPending ? (
                    <>
                      {!canApprove ? (
                        <p className="utility-month-card__warn">
                          業主未填寫租客應付金額，核准前請先請業主重新上傳並填寫金額。
                        </p>
                      ) : null}
                      <div className="utility-month-card__actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={reviewingMonth === month || !canApprove}
                          onClick={() => onReview(month, true)}
                        >
                          {reviewingMonth === month ? '處理中…' : '核准'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={reviewingMonth === month}
                          onClick={() => onReview(month, false)}
                        >
                          駁回
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="muted utility-month-card__reviewed">
                      {files[0]?.reviewed_at ? `審核於 ${fmt(files[0].reviewed_at)}` : '已審核'}
                      {files[0]?.review_notes?.trim() ? ` · ${files[0].review_notes.trim()}` : ''}
                    </p>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
