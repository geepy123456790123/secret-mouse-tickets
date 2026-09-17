import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const compiled = await build({entryPoints:['lib/email.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
  name:'email-preview-runtime',setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'runtime',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = {};',loader:'js'}));
  },
}]});
const emails=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const event={event_page_url:'https://example.invalid/tickets?offer=one&party=two',info_banner_first:'Autumn <Magic> & More',valid_start_date:'2026-10-01',valid_end_date:'2026-10-14'};
const base={recipientEmail:'preview@example.invalid',event,themeParkDays:3};

test('confirmation preserves the purchase link, dates, reference, and plain-text fallback',()=>{
 const message=emails.buildConfirmationEmail({...base,origin:'https://secretmousetickets.com',confirmationNumber:'SMT-<123>'});
 assert.equal(message.subject,'Secret Mouse Tickets Confirmation');
 assert.ok(message.bodyText.includes(event.event_page_url));
 assert.ok(message.html.includes('href="https://example.invalid/tickets?offer=one&amp;party=two"'));
 assert.ok(message.html.includes('SMT-&lt;123&gt;'));
 assert.ok(message.html.includes('Oct 1, 2026'));
 assert.ok(message.html.includes('Oct 14, 2026'));
 assert.ok(message.html.includes('Additional Disney Magic'));
 assert.ok(message.html.includes('/secret-mouse-email-logo.png'));
 assert.ok(message.html.includes('role="presentation"'));
});

test('both reminder stages preserve checkout destinations and escape offer and coupon content',()=>{
 for(const stage of ['2h','24h']){
  for(const couponCode of [undefined,'COME<BACK>&25']){
   const message=emails.buildCheckoutReminderEmail({...base,stage,couponCode,checkoutUrl:'https://secretmousetickets.com/checkout/example?coupon=a&b=c'});
   assert.ok(message.bodyText.includes('/checkout/example?coupon=a&b=c'));
   assert.ok(message.html.includes('href="https://secretmousetickets.com/checkout/example?coupon=a&amp;b=c"'));
   assert.ok(message.html.includes('Autumn &lt;Magic&gt; &amp; More'));
   assert.equal(message.html.includes('25% off our matching fee'),Boolean(couponCode));
   if(couponCode)assert.ok(message.html.includes('COME&lt;BACK&gt;&amp;25'));
   assert.ok(message.html.includes(stage==='2h'?'Return to checkout':'Finish checkout'));
  }
 }
});

test('single-day messages omit the multi-day benefit in HTML and plain text',()=>{
 const messages=[emails.buildConfirmationEmail({...base,themeParkDays:1,origin:'https://secretmousetickets.com',confirmationNumber:'SMT-TEST'}),emails.buildCheckoutReminderEmail({...base,themeParkDays:1,stage:'2h',checkoutUrl:'https://secretmousetickets.com/checkout/example'})];
 for(const message of messages){
  assert.ok(!message.html.includes('Additional Disney Magic'));
  assert.ok(!message.bodyText.includes('Additional Disney Magic'));
 }
});

test('review request retains its destination and uses the shared design',()=>{
 const message=emails.buildTrustpilotReviewEmail({recipientEmail:base.recipientEmail,reviewUrl:'https://example.invalid/review?a=1&b=2'});
 assert.ok(message.html.includes('href="https://example.invalid/review?a=1&amp;b=2"'));
 assert.ok(message.html.includes('/secret-mouse-email-logo.png'));
 assert.ok(!message.html.includes('border:4px'));
 assert.ok(message.bodyText.includes('https://example.invalid/review?a=1&b=2'));
});
