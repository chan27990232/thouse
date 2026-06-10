/**
 * 填入香港公眾假期（農曆／復活節等變動日期，2010–2029）
 * 固定假期（元旦、五一、七一、國慶、聖誕）已由 calendar_days_hk_public_holidays.sql 處理
 *
 * 資料來源：政府憲報公布之一般公眾假期（GovHK / 1823）
 * 執行：node scripts/seed-hk-public-holidays.mjs
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvFile(p, override) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (override) process.env[k] = v;
    else if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

loadEnvFile(join(root, '.env'), false);
loadEnvFile(join(root, '.env.local'), true);

/** [YYYY-MM-DD, name_zh, name_en] — 不含已由 SQL 產生之固定五日 */
const VARIABLE_HOLIDAYS = [
  // 2010
  ['2010-02-13', '農曆年初一', "Lunar New Year's Day"],
  ['2010-02-14', '農曆年初二', 'The second day of Lunar New Year'],
  ['2010-02-15', '農曆年初三', 'The third day of Lunar New Year'],
  ['2010-04-02', '耶穌受難節', 'Good Friday'],
  ['2010-04-03', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2010-04-05', '清明節', 'Ching Ming Festival'],
  ['2010-04-06', '復活節星期一', 'Easter Monday'],
  ['2010-05-21', '佛誕', 'The Birthday of the Buddha'],
  ['2010-06-16', '端午節', 'Tuen Ng Festival'],
  ['2010-09-23', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2010-10-16', '重陽節', 'Chung Yeung Festival'],
  ['2010-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2011
  ['2011-02-03', '農曆年初一', "Lunar New Year's Day"],
  ['2011-02-04', '農曆年初二', 'The second day of Lunar New Year'],
  ['2011-02-05', '農曆年初三', 'The third day of Lunar New Year'],
  ['2011-04-22', '耶穌受難節', 'Good Friday'],
  ['2011-04-23', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2011-04-25', '復活節星期一', 'Easter Monday'],
  ['2011-04-05', '清明節', 'Ching Ming Festival'],
  ['2011-05-10', '佛誕', 'The Birthday of the Buddha'],
  ['2011-06-06', '端午節', 'Tuen Ng Festival'],
  ['2011-09-13', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2011-10-05', '重陽節', 'Chung Yeung Festival'],
  ['2011-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],
  ['2011-12-27', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2012
  ['2012-01-23', '農曆年初一', "Lunar New Year's Day"],
  ['2012-01-24', '農曆年初二', 'The second day of Lunar New Year'],
  ['2012-01-25', '農曆年初三', 'The third day of Lunar New Year'],
  ['2012-04-06', '耶穌受難節', 'Good Friday'],
  ['2012-04-07', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2012-04-09', '復活節星期一', 'Easter Monday'],
  ['2012-04-04', '清明節', 'Ching Ming Festival'],
  ['2012-05-28', '佛誕', 'The Birthday of the Buddha'],
  ['2012-06-23', '端午節', 'Tuen Ng Festival'],
  ['2012-10-01', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2012-10-23', '重陽節', 'Chung Yeung Festival'],
  ['2012-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2013
  ['2013-02-10', '農曆年初一', "Lunar New Year's Day"],
  ['2013-02-11', '農曆年初二', 'The second day of Lunar New Year'],
  ['2013-02-12', '農曆年初三', 'The third day of Lunar New Year'],
  ['2013-03-29', '耶穌受難節', 'Good Friday'],
  ['2013-03-30', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2013-04-01', '復活節星期一', 'Easter Monday'],
  ['2013-04-04', '清明節', 'Ching Ming Festival'],
  ['2013-05-17', '佛誕', 'The Birthday of the Buddha'],
  ['2013-06-12', '端午節', 'Tuen Ng Festival'],
  ['2013-09-20', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2013-10-14', '重陽節', 'Chung Yeung Festival'],
  ['2013-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2014
  ['2014-01-31', '農曆年初一', "Lunar New Year's Day"],
  ['2014-02-01', '農曆年初二', 'The second day of Lunar New Year'],
  ['2014-02-03', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2014-04-18', '耶穌受難節', 'Good Friday'],
  ['2014-04-19', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2014-04-21', '復活節星期一', 'Easter Monday'],
  ['2014-04-05', '清明節', 'Ching Ming Festival'],
  ['2014-05-06', '佛誕', 'The Birthday of the Buddha'],
  ['2014-06-02', '端午節', 'Tuen Ng Festival'],
  ['2014-09-09', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2014-10-02', '重陽節', 'Chung Yeung Festival'],
  ['2014-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2015
  ['2015-02-19', '農曆年初一', "Lunar New Year's Day"],
  ['2015-02-20', '農曆年初二', 'The second day of Lunar New Year'],
  ['2015-02-21', '農曆年初三', 'The third day of Lunar New Year'],
  ['2015-04-03', '耶穌受難節', 'Good Friday'],
  ['2015-04-04', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2015-04-06', '復活節星期一', 'Easter Monday'],
  ['2015-04-05', '清明節', 'Ching Ming Festival'],
  ['2015-05-25', '佛誕', 'The Birthday of the Buddha'],
  ['2015-06-20', '端午節', 'Tuen Ng Festival'],
  ['2015-09-28', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2015-10-21', '重陽節', 'Chung Yeung Festival'],
  ['2015-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2016
  ['2016-02-08', '農曆年初一', "Lunar New Year's Day"],
  ['2016-02-09', '農曆年初二', 'The second day of Lunar New Year'],
  ['2016-02-10', '農曆年初三', 'The third day of Lunar New Year'],
  ['2016-03-25', '耶穌受難節', 'Good Friday'],
  ['2016-03-26', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2016-03-28', '復活節星期一', 'Easter Monday'],
  ['2016-04-04', '清明節', 'Ching Ming Festival'],
  ['2016-05-14', '佛誕', 'The Birthday of the Buddha'],
  ['2016-06-09', '端午節', 'Tuen Ng Festival'],
  ['2016-09-16', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2016-10-10', '重陽節', 'Chung Yeung Festival'],
  ['2016-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],
  ['2016-12-27', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2017
  ['2017-01-28', '農曆年初一', "Lunar New Year's Day"],
  ['2017-01-30', '農曆年初三', 'The third day of Lunar New Year'],
  ['2017-01-31', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2017-04-14', '耶穌受難節', 'Good Friday'],
  ['2017-04-15', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2017-04-17', '復活節星期一', 'Easter Monday'],
  ['2017-04-04', '清明節', 'Ching Ming Festival'],
  ['2017-05-03', '佛誕', 'The Birthday of the Buddha'],
  ['2017-05-30', '端午節', 'Tuen Ng Festival'],
  ['2017-10-05', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2017-10-28', '重陽節', 'Chung Yeung Festival'],
  ['2017-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2018
  ['2018-02-16', '農曆年初一', "Lunar New Year's Day"],
  ['2018-02-17', '農曆年初二', 'The second day of Lunar New Year'],
  ['2018-02-19', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2018-03-30', '耶穌受難節', 'Good Friday'],
  ['2018-03-31', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2018-04-02', '復活節星期一', 'Easter Monday'],
  ['2018-04-05', '清明節', 'Ching Ming Festival'],
  ['2018-05-22', '佛誕', 'The Birthday of the Buddha'],
  ['2018-06-18', '端午節', 'Tuen Ng Festival'],
  ['2018-09-25', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2018-10-17', '重陽節', 'Chung Yeung Festival'],
  ['2018-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2019
  ['2019-02-05', '農曆年初一', "Lunar New Year's Day"],
  ['2019-02-06', '農曆年初二', 'The second day of Lunar New Year'],
  ['2019-02-07', '農曆年初三', 'The third day of Lunar New Year'],
  ['2019-04-19', '耶穌受難節', 'Good Friday'],
  ['2019-04-20', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2019-04-22', '復活節星期一', 'Easter Monday'],
  ['2019-04-05', '清明節', 'Ching Ming Festival'],
  ['2019-05-12', '佛誕', 'The Birthday of the Buddha'],
  ['2019-06-07', '端午節', 'Tuen Ng Festival'],
  ['2019-09-14', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2019-10-07', '重陽節', 'Chung Yeung Festival'],
  ['2019-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2020
  ['2020-01-25', '農曆年初一', "Lunar New Year's Day"],
  ['2020-01-27', '農曆年初三', 'The third day of Lunar New Year'],
  ['2020-01-28', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2020-04-10', '耶穌受難節', 'Good Friday'],
  ['2020-04-11', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2020-04-13', '復活節星期一', 'Easter Monday'],
  ['2020-04-04', '清明節', 'Ching Ming Festival'],
  ['2020-04-30', '佛誕', 'The Birthday of the Buddha'],
  ['2020-06-25', '端午節', 'Tuen Ng Festival'],
  ['2020-10-01', '國慶日／中秋節', 'National Day / Chinese Mid-Autumn Festival'],
  ['2020-10-26', '重陽節', 'Chung Yeung Festival'],
  ['2020-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2021
  ['2021-02-12', '農曆年初一', "Lunar New Year's Day"],
  ['2021-02-13', '農曆年初二', 'The second day of Lunar New Year'],
  ['2021-02-14', '農曆年初三', 'The third day of Lunar New Year'],
  ['2021-04-02', '耶穌受難節', 'Good Friday'],
  ['2021-04-03', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2021-04-05', '清明節／復活節星期一', 'Ching Ming Festival / Easter Monday'],
  ['2021-05-19', '佛誕', 'The Birthday of the Buddha'],
  ['2021-06-14', '端午節', 'Tuen Ng Festival'],
  ['2021-09-22', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2021-10-14', '重陽節', 'Chung Yeung Festival'],
  ['2021-12-27', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2022
  ['2022-02-01', '農曆年初一', "Lunar New Year's Day"],
  ['2022-02-02', '農曆年初二', 'The second day of Lunar New Year'],
  ['2022-02-03', '農曆年初三', 'The third day of Lunar New Year'],
  ['2022-04-15', '耶穌受難節', 'Good Friday'],
  ['2022-04-16', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2022-04-18', '復活節星期一', 'Easter Monday'],
  ['2022-04-05', '清明節', 'Ching Ming Festival'],
  ['2022-05-09', '佛誕翌日', 'The day following the Birthday of the Buddha'],
  ['2022-06-03', '端午節', 'Tuen Ng Festival'],
  ['2022-09-12', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2022-10-04', '重陽節', 'Chung Yeung Festival'],
  ['2022-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2023（憲報）
  ['2023-01-02', '一月一日翌日', 'The day following the first day of January'],
  ['2023-01-23', '農曆年初二', 'The second day of Lunar New Year'],
  ['2023-01-24', '農曆年初三', 'The third day of Lunar New Year'],
  ['2023-01-25', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2023-04-05', '清明節', 'Ching Ming Festival'],
  ['2023-04-07', '耶穌受難節', 'Good Friday'],
  ['2023-04-08', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2023-04-10', '復活節星期一', 'Easter Monday'],
  ['2023-05-26', '佛誕', 'The Birthday of the Buddha'],
  ['2023-06-22', '端午節', 'Tuen Ng Festival'],
  ['2023-09-30', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2023-10-02', '國慶日翌日', 'The day following National Day'],
  ['2023-10-23', '重陽節', 'Chung Yeung Festival'],
  ['2023-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2024（憲報）
  ['2024-02-10', '農曆年初一', "Lunar New Year's Day"],
  ['2024-02-12', '農曆年初三', 'The third day of Lunar New Year'],
  ['2024-02-13', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2024-03-29', '耶穌受難節', 'Good Friday'],
  ['2024-03-30', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2024-04-01', '復活節星期一', 'Easter Monday'],
  ['2024-04-04', '清明節', 'Ching Ming Festival'],
  ['2024-05-15', '佛誕', 'The Birthday of the Buddha'],
  ['2024-06-10', '端午節', 'Tuen Ng Festival'],
  ['2024-09-18', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2024-10-11', '重陽節', 'Chung Yeung Festival'],
  ['2024-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2025
  ['2025-01-29', '農曆年初一', "Lunar New Year's Day"],
  ['2025-01-30', '農曆年初二', 'The second day of Lunar New Year'],
  ['2025-01-31', '農曆年初三', 'The third day of Lunar New Year'],
  ['2025-04-04', '清明節', 'Ching Ming Festival'],
  ['2025-04-18', '耶穌受難節', 'Good Friday'],
  ['2025-04-19', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2025-04-21', '復活節星期一', 'Easter Monday'],
  ['2025-05-05', '佛誕', 'The Birthday of the Buddha'],
  ['2025-05-31', '端午節', 'Tuen Ng Festival'],
  ['2025-10-07', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2025-10-29', '重陽節', 'Chung Yeung Festival'],
  ['2025-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2026（憲報）
  ['2026-02-17', '農曆年初一', "Lunar New Year's Day"],
  ['2026-02-18', '農曆年初二', 'The second day of Lunar New Year'],
  ['2026-02-19', '農曆年初三', 'The third day of Lunar New Year'],
  ['2026-04-03', '耶穌受難節', 'Good Friday'],
  ['2026-04-04', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2026-04-06', '清明節翌日', 'The day following Ching Ming Festival'],
  ['2026-04-07', '復活節星期一翌日', 'The day following Easter Monday'],
  ['2026-05-25', '佛誕翌日', 'The day following the Birthday of the Buddha'],
  ['2026-06-19', '端午節', 'Tuen Ng Festival'],
  ['2026-09-26', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2026-10-19', '重陽節翌日', 'The day following Chung Yeung Festival'],
  ['2026-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2027（憲報）
  ['2027-02-06', '農曆年初一', "Lunar New Year's Day"],
  ['2027-02-08', '農曆年初三', 'The third day of Lunar New Year'],
  ['2027-02-09', '農曆年初四', 'The fourth day of Lunar New Year'],
  ['2027-03-26', '耶穌受難節', 'Good Friday'],
  ['2027-03-27', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2027-03-29', '復活節星期一', 'Easter Monday'],
  ['2027-04-05', '清明節', 'Ching Ming Festival'],
  ['2027-05-13', '佛誕', 'The Birthday of the Buddha'],
  ['2027-06-09', '端午節', 'Tuen Ng Festival'],
  ['2027-09-16', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2027-10-08', '重陽節', 'Chung Yeung Festival'],
  ['2027-12-27', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  // 2028–2029：政府尚未公布完整憲報列表，僅預填常見農曆／復活節估算（待憲報後更新）
  ['2028-01-26', '農曆年初一', "Lunar New Year's Day"],
  ['2028-01-27', '農曆年初二', 'The second day of Lunar New Year'],
  ['2028-01-28', '農曆年初三', 'The third day of Lunar New Year'],
  ['2028-04-14', '耶穌受難節', 'Good Friday'],
  ['2028-04-15', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2028-04-17', '復活節星期一', 'Easter Monday'],
  ['2028-04-04', '清明節', 'Ching Ming Festival'],
  ['2028-05-02', '佛誕', 'The Birthday of the Buddha'],
  ['2028-05-28', '端午節', 'Tuen Ng Festival'],
  ['2028-10-03', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2028-10-23', '重陽節', 'Chung Yeung Festival'],
  ['2028-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],

  ['2029-02-13', '農曆年初一', "Lunar New Year's Day"],
  ['2029-02-14', '農曆年初二', 'The second day of Lunar New Year'],
  ['2029-02-15', '農曆年初三', 'The third day of Lunar New Year'],
  ['2029-03-30', '耶穌受難節', 'Good Friday'],
  ['2029-03-31', '耶穌受難節翌日', 'The day following Good Friday'],
  ['2029-04-02', '復活節星期一', 'Easter Monday'],
  ['2029-04-05', '清明節', 'Ching Ming Festival'],
  ['2029-05-22', '佛誕', 'The Birthday of the Buddha'],
  ['2029-06-16', '端午節', 'Tuen Ng Festival'],
  ['2029-09-22', '中秋節翌日', 'The day following the Chinese Mid-Autumn Festival'],
  ['2029-10-13', '重陽節', 'Chung Yeung Festival'],
  ['2029-12-26', '聖誕節後第一個周日', 'The first weekday after Christmas Day'],
];

const connectionString = (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!connectionString) {
  console.error('請在 .env.local 設定 SUPABASE_DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();

let upserted = 0;
for (const [date, nameZh, nameEn] of VARIABLE_HOLIDAYS) {
  const res = await client.query(
    `insert into public.hong_kong_public_holidays (holiday_date, name_zh, name_en)
     values ($1::date, $2, $3)
     on conflict (holiday_date) do update
     set name_zh = excluded.name_zh, name_en = excluded.name_en`,
    [date, nameZh, nameEn]
  );
  upserted += res.rowCount ?? 0;
}

await client.query('select public.sync_calendar_public_holidays()');

const count = await client.query(
  `select count(*)::int as n from public.calendar_days where is_public_holiday`
);
const sample = await client.query(
  `select calendar_date, public_holiday_name_zh
   from public.calendar_days
   where is_public_holiday and year = 2026
   order by calendar_date`
);

await client.end();

console.log(`已更新變動公眾假期 ${VARIABLE_HOLIDAYS.length} 筆，calendar_days 標記假期共 ${count.rows[0].n} 日`);
console.log('2026 年範例：');
for (const row of sample.rows) {
  const d = row.calendar_date.toISOString().slice(0, 10);
  console.log(`  ${d}  ${row.public_holiday_name_zh}`);
}
