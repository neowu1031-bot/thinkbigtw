/* Shared-data and confirmation behavior; does not assert rendered layout. */
const assert = require('node:assert/strict');
const {boot} = require('./test-portfolio-dom.cjs');
for (const en of [false,true]) {
  const {q,click,nav,data,w} = boot(en);
  assert.ok(q('#demo-help .demo-notice'));
  assert.ok(q('#demo-help .shared-data-note'));
  assert.equal(q('#demo-help').open,false);
  assert.equal(q('#tour').hidden,false);
  click('[data-action=tour-skip]');
  assert.equal(q('#tour').hidden,true);
  assert.equal(w.localStorage.getItem('tb-erp-tour'),'done');
  const stock = () => data().products.find(p=>p.id==='P001').stock;
  const before = stock();
  assert.equal(q('#manual-data tbody tr strong').textContent,String(before));
  click('[data-mode=agent]');
  click('.agent-examples button');
  assert.ok(q('#agent-confirm'));
  assert.equal(stock(),before,'Preview must not write');
  q('#agent-confirm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(stock(),before-5);
  assert.ok(q('#agent-result').textContent.includes(data().orders.at(-1).id));
  assert.ok(q('#agent-data [data-product=P001]').classList.contains('agent-changed'));
  click('[data-mode=manual]');nav('dashboard');
  assert.equal(q('#manual-data [data-product=P001] strong').textContent,String(before-5));
  click('#undo-toast [data-action=undo]');
  assert.equal(stock(),before);
  assert.equal(q('#manual-data [data-product=P001] strong').textContent,String(before));
  nav('purchases');assert.equal(q('.order-steps').children.length,3);
  w.close();
}
console.log('PASS: bilingual preview, receipt, highlight, shared inventory, undo and three-step form');
