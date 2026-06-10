-- 銀行轉賬收據／截圖（公開網址，通常為 Storage getPublicUrl）
alter table public.lease_applications
  add column if not exists bank_transfer_receipt_url text;

comment on column public.lease_applications.bank_transfer_receipt_url is '租客銀行轉賬證明截圖或收據的公開 URL';
