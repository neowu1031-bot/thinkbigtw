/* Exercise viewport selection and live reduced-motion changes without a browser. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('assets/homesplit/editorial.js', 'utf8');
function setup(reduced = false) {
  const observed = new Set(), arriving = new Set();
  let notify;
  const motion = {matches: reduced};
  const section = (top, excluded = false) => ({
    closest: () => excluded, getBoundingClientRect: () => ({top}),
    classList: {add: name => { if (name === 'arriving') arriving.add(top); }}
  });
  const sections = [section(-200), section(0), section(650), section(900, true), section(1000)];
  class Observer {
    constructor(fn) { notify = fn; }
    observe(el) { observed.add(el); }
    unobserve(el) { observed.delete(el); }
  }
  vm.runInNewContext(code, {
    window: {innerHeight: 800, matchMedia: () => motion, IntersectionObserver: Observer},
    IntersectionObserver: Observer,
    document: {getElementById: () => null, querySelector: () => null,
      querySelectorAll: sel => sel === '.section-head' ? sections : []}
  });
  return {observed, arriving, motion, sections, enter: el => notify([{target: el, isIntersecting: true}])};
}
test('initial viewport and explicit hero exclusions never receive a reveal animation', () => {
  const x = setup();
  assert.deepEqual([...x.observed], [x.sections[4]]);
  x.enter(x.sections[4]);
  assert.deepEqual([...x.arriving], [1000]);
  assert.equal(x.observed.size, 0);
});
test('reduced motion skips reveals, including a change before an observer callback', () => {
  assert.equal(setup(true).observed.size, 0);
  const x = setup(); x.motion.matches = true; x.enter(x.sections[4]);
  assert.equal(x.arriving.size, 0);
});
