import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://postgres.lmrpabhkwfdhdggphktl:8HxmiaNrSLWavo4s@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
});

await client.connect();

const fn = await client.query(`
  select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'delete_conversation_as_participant'
`);
console.log('rpc_exists', fn.rows.length > 0);

const policies = await client.query(`
  select polname, polcmd::text
  from pg_policy
  where polrelid = 'public.conversation_messages'::regclass
`);
console.log('message_policies', policies.rows);

const convPolicies = await client.query(`
  select polname, polcmd::text
  from pg_policy
  where polrelid = 'public.conversations'::regclass
`);
console.log('conv_policies', convPolicies.rows);

await client.end();
