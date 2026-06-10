-- 通知 PostgREST 重新載入 schema 快取（套用新 RPC 後若仍報 schema cache 錯誤可執行）
NOTIFY pgrst, 'reload schema';
