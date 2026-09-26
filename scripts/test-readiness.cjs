const {test} = require('node:test');
const assert = require('node:assert/strict');
const {assess, allowed} = require('../assets/homesplit/readiness.js');
const ready = ['service','clear','ready','owner','local','defined'];
test('clear prerequisites permit a pilot discussion, never a promise or score', () => {
  assert.deepEqual(assess(ready), {department:'客服',stage:'pilot',actions:['sample','local']});
  assert.deepEqual(ready,['service','clear','ready','owner','local','defined']);
});
test('each missing foundation takes precedence over a polished use case', () => {
  for(const [position,value,action] of [[1,'unclear','flow'],[2,'unknown','data'],[3,'none','owner'],[4,'undecided','boundary']]) {
    const a = ready.slice();a[position]=value;
    assert.equal(assess(a).stage,'discovery');assert.ok(assess(a).actions.includes(action));
  }
});
test('partly prepared workflows receive specific preparation, not rejection', () => {
  for(const [position,value,action] of [[1,'partial','flow'],[2,'scattered','data'],[3,'team','owner'],[5,'rough','acceptance'],[5,'explore','acceptance']]) {
    const a=ready.slice();a[position]=value;
    assert.equal(assess(a).stage,'prepare');assert.ok(assess(a).actions.includes(action));
  }
});
test('all 1215 valid combinations are deterministic; privacy condition never changes department', () => {
  const all=allowed.reduce((rows,values)=>rows.flatMap(row=>values.map(value=>[...row,value])),[[]]);
  assert.equal(all.length,1215);
  for(const a of all) {
    const r=assess(a);assert.deepEqual(r,assess(a));assert.ok(r.actions.length);
    assert.equal(r.department,assess([a[0],...ready.slice(1)]).department);
    assert.equal(r.actions.includes('local'),a[4]==='local');assert.equal(r.actions.includes('approved'),a[4]==='approved');
    assert.ok(!('score' in r));
  }
});
test('incomplete, out-of-range and unexpected inputs cannot produce a result', () => {
  for(const a of [[],ready.slice(1),[...ready,'extra'],null,{},[...ready.slice(0,5),null],['<script>',...ready.slice(1)]]) assert.throws(()=>assess(a),TypeError);
});
