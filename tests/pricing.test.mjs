import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

async function moduleFrom(path, plugins = []) {
  const compiled = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm', plugins });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
}
const { migrateServiceFee } = await moduleFrom('lib/price-migration.ts');
const { priceForCoupon, PRICE_CENTS } = await moduleFrom('lib/coupons.ts');

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE coupons (id INTEGER PRIMARY KEY, code TEXT UNIQUE, discount_cents INTEGER, active INTEGER DEFAULT 1, max_redemptions INTEGER, redemption_count INTEGER DEFAULT 0, expires_at TEXT);
    CREATE TABLE orders (id TEXT PRIMARY KEY, amount_cents INTEGER, coupon_code TEXT, status TEXT DEFAULT 'pending', square_payment_link_id TEXT, square_order_id TEXT, paypal_order_id TEXT, paypal_payment_status TEXT);
    INSERT INTO coupons (code, discount_cents) VALUES ('BACKTOSCHOOL',3120), ('COMEBACK25',975), ('SUMMERDEAL25',975), ('IGFREE',3900), ('FBFREE',3900), ('TEST00',3900), ('ROUND',1000);
    INSERT INTO orders (id,amount_cents,coupon_code) VALUES ('full',3900,NULL), ('older',5700,NULL), ('quarter',2925,'COMEBACK25'), ('free',0,'TEST00'), ('cheaper',100,'REMOVED'), ('twenty',3900,'BACKTOSCHOOL');
    INSERT INTO orders (id,amount_cents,coupon_code,status) VALUES ('paid',4275,'SUMMERDEAL25','paid');
    INSERT INTO orders (id,amount_cents,paypal_order_id,paypal_payment_status) VALUES ('paypal',3900,'OLD-APPROVAL','PAYER_ACTION_REQUIRED');`);
  const db = {
    prepare(sql) {
      let values = [];
      return { bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { return sqlite.prepare(sql).run(...values); } };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  return { db, sqlite };
}

test('reprices every coupon and unpaid order, preserving paid and cheaper orders', async () => {
  const { db, sqlite } = fixture();
  sqlite.exec("UPDATE coupons SET active=0, max_redemptions=20, redemption_count=12, expires_at='2026-08-31' WHERE code='FBFREE'");
  await migrateServiceFee(db, {});
  assert.equal(PRICE_CENTS,2900);
  assert.equal(await priceForCoupon(db,null),2900);
  assert.equal(await priceForCoupon(db,'COMEBACK25'),2175);
  assert.equal(await priceForCoupon(db,'SUMMERDEAL25'),2175);
  assert.equal(await priceForCoupon(db,'BACKTOSCHOOL'),2320);
  assert.equal(await priceForCoupon(db,'IGFREE'),0);
  assert.equal(await priceForCoupon(db,'TEST00'),0);
  assert.equal(sqlite.prepare("SELECT discount_cents FROM coupons WHERE code='ROUND'").get().discount_cents,744);
  const expired = sqlite.prepare("SELECT * FROM coupons WHERE code='FBFREE'").get();
  assert.deepEqual([expired.discount_cents,expired.active,expired.max_redemptions,expired.redemption_count,expired.expires_at],[2900,0,20,12,'2026-08-31']);
  const amounts = Object.fromEntries(sqlite.prepare('SELECT id,amount_cents FROM orders').all().map(r=>[r.id,r.amount_cents]));
  assert.deepEqual(amounts,{full:2900,older:2900,quarter:2175,free:0,cheaper:100,twenty:2320,paid:4275,paypal:2900});
  assert.equal(sqlite.prepare("SELECT paypal_order_id FROM orders WHERE id='paypal'").get().paypal_order_id,null);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM service_fee_migration_backup WHERE entity='order' AND entity_id='paid'").get().n,0);
  await migrateServiceFee(db, {});
  assert.equal(await priceForCoupon(db,'COMEBACK25'),2175,'second run must not scale discounts again');
  sqlite.close();
});

test('coupon validation still rejects expired, inactive, exhausted and unknown codes', async () => {
  const { db, sqlite } = fixture();
  await migrateServiceFee(db,{});
  await assert.rejects(priceForCoupon(db,'UNKNOWN'),/not found/);
  sqlite.exec("UPDATE coupons SET active=0 WHERE code='IGFREE'; UPDATE coupons SET expires_at='2000-01-01' WHERE code='FBFREE'; UPDATE coupons SET max_redemptions=1,redemption_count=1 WHERE code='TEST00'");
  await assert.rejects(priceForCoupon(db,'IGFREE'),/not found/);
  await assert.rejects(priceForCoupon(db,'FBFREE'),/expired/);
  await assert.rejects(priceForCoupon(db,'TEST00'),/limit/);
  sqlite.close();
});

test('legacy Square link is repriced before migration completes', async () => {
  const { db, sqlite } = fixture();
  sqlite.exec("UPDATE orders SET square_payment_link_id='LINK',square_order_id='SQUARE-ORDER' WHERE id='quarter'");
  const originalFetch = globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options)=>{
    calls.push({url,options});
    return Response.json({order:options.method==='PUT' ? {total_money:{amount:2175}} : {version:1,state:'DRAFT',line_items:[{uid:'ITEM',quantity:'1'}],total_money:{amount:2925}}});
  };
  try {
    await migrateServiceFee(db,{SQUARE_ACCESS_TOKEN:'test-only',SQUARE_ENVIRONMENT:'production'});
    assert.equal(calls.length,2);
    assert.equal(JSON.parse(calls[1].options.body).order.line_items[0].base_price_money.amount,2175);
    assert.equal(sqlite.prepare("SELECT amount_cents FROM orders WHERE id='quarter'").get().amount_cents,2175);
  } finally {globalThis.fetch=originalFetch;sqlite.close();}
});

test('failed legacy provider update leaves DB prices and migration marker untouched', async()=>{
  const {db,sqlite}=fixture();
  sqlite.exec("UPDATE orders SET square_payment_link_id='LINK',square_order_id='SQUARE-ORDER' WHERE id='quarter'");
  await assert.rejects(migrateServiceFee(db,{}),/credentials/);
  assert.equal(sqlite.prepare("SELECT discount_cents FROM coupons WHERE code='COMEBACK25'").get().discount_cents,975);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM service_fee_migrations').get().n,0);
  sqlite.close();
});

const routeStubs = {name:'isolated-payment-tests', setup(b){
  b.onResolve({filter:/^cloudflare:workers$|^@\/db$|^@\/lib\/(orders|meta-conversions)$/},args=>({path:args.path,namespace:'test-stub'}));
  b.onLoad({filter:/.*/,namespace:'test-stub'},args=>({contents:
    args.path==='cloudflare:workers' ? 'export const env = {SQUARE_ACCESS_TOKEN:"test",SQUARE_LOCATION_ID:"test",SQUARE_ENVIRONMENT:"sandbox",PAYPAL_CLIENT_ID:"test",PAYPAL_CLIENT_SECRET:"test",PAYPAL_ENVIRONMENT:"sandbox"};' :
    args.path==='@/db' ? 'export async function ensureDatabase(){}; export function getRawDb(){return globalThis.pricingTestDb;}' :
    args.path==='@/lib/orders' ? 'export async function markOrderPaidAndSendConfirmation(){return {ok:true,confirmationNumber:"test"};}' :
    'export function getClientIpAddress(){return null};export async function sendMetaConversionEvent(){};',loader:'js'}));
}};
const square = await moduleFrom('app/api/checkout/pay/route.ts',[routeStubs]);
const paypal = await moduleFrom('app/api/checkout/paypal/create/route.ts',[routeStubs]);
const capture = await moduleFrom('app/api/checkout/paypal/capture/route.ts',[routeStubs]);

test('Square and PayPal receive exact $29, 25%-off, and 20%-off totals', async()=>{
  const originalFetch=globalThis.fetch;
  try {
    for(const amount of [2900,2175,2320]) {
      globalThis.pricingTestDb={prepare(){return {bind(){return this;},async first(){return {id:'test-order',status:'pending',amount_cents:amount,currency:'USD',recipient_email:'test@example.invalid'};},async run(){}};}};
      const bodies=[];
      globalThis.fetch=async(url,options)=>{
        if(url.endsWith('/v1/oauth2/token')) return Response.json({access_token:'test-only'});
        bodies.push({url,body:JSON.parse(options.body)});
        if(url.endsWith('/v2/payments')) return Response.json({payment:{id:'payment',status:'COMPLETED',total_money:{amount,currency:'USD'}}});
        return Response.json({id:'PAYPAL-TEST',status:'CREATED'});
      };
      const request=()=>new Request('https://example.invalid/api/checkout/pay',{method:'POST',body:JSON.stringify({orderId:'test-order',sourceId:'test-token'})});
      assert.equal((await square.POST(request())).status,200);
      assert.equal((await paypal.POST(request())).status,200);
      assert.equal(bodies[0].body.amount_money.amount,amount);
      assert.equal(bodies[1].body.purchase_units[0].amount.value,(amount/100).toFixed(2));
    }
  } finally {globalThis.fetch=originalFetch;delete globalThis.pricingTestDb;}
});

test('stale PayPal approval is rejected before any capture request',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.pricingTestDb={prepare(){return {bind(){return this;},async first(){return {id:'test-order',status:'pending',amount_cents:2900,paypal_order_id:null};}};}};
  globalThis.fetch=()=>{throw new Error('must not capture stale approval');};
  try {
    const response=await capture.POST(new Request('https://example.invalid/api/checkout/paypal/capture',{method:'POST',body:JSON.stringify({orderId:'test-order',paypalOrderId:'OLD-APPROVAL'})}));
    assert.equal(response.status,409);
  } finally {globalThis.fetch=originalFetch;delete globalThis.pricingTestDb;}
});
