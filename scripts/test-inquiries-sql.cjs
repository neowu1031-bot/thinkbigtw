/* Ephemeral local PostgreSQL via PGlite. No connection to Supabase. */
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(fs.readFileSync('supabase/migrations/20260927_thinkbig_inquiries.sql','utf8'));
  await db.exec('set role anon');await assert.rejects(()=>db.query('select * from public.thinkbig_inquiries'));
  await assert.rejects(()=>db.query("select public.submit_thinkbig_inquiry(gen_random_uuid(),'n','','need','scale','email','test@example.invalid')"));
  await db.exec('reset role; set role service_role');
  const params=['8ad41fb7-5f78-442a-b1f3-27a3e113196e','測試','','工作摘要','待確認','email','test@example.invalid'];
  const sql='select public.submit_thinkbig_inquiry($1,$2,$3,$4,$5,$6,$7) as result';
  const submit=async values=>(await db.query(sql,values)).rows[0].result;
  assert.equal(await submit(params),'accepted');assert.equal(await submit(params),'duplicate');
  assert.equal(await submit(params.map((v,i)=>i===3?'changed':v)),'conflict');
  for(const id of ['d4a175f2-3c25-44a8-aa2b-1bff9adbc2dc','a6f7e4ee-a9f1-42a6-9922-9ccf9bc2bf07'])assert.equal(await submit([id,...params.slice(1)]),'accepted');
  assert.equal(await submit(['34d6a5f9-babc-48ea-8cf3-e82b379254b9',...params.slice(1)]),'rate_limited');
  assert.equal((await db.query('select count(*)::int as n from public.thinkbig_inquiries')).rows[0].n,3);
  await db.exec('reset role');
  await db.exec("update public.thinkbig_inquiries set consent_at = now() - interval '31 days'; delete from public.thinkbig_inquiries where consent_at <= now() - interval '30 days';");
  assert.equal((await db.query('select count(*)::int as n from public.thinkbig_inquiries')).rows[0].n,0);
  console.log('PASS SQL: migration, anon table/RPC denial, service_role, duplicate, conflict, contact rate limit, 30-day deletion');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
