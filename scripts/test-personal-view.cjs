/* DOM behavior only: browser layout, native dialog focus trap and media decoding
   are covered by the manual/browser review, not by these mocks. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require(process.env.JSDOM_MODULE || 'jsdom');
const fs = require('node:fs');
const html = fs.readFileSync('pricing/personal/index.html', 'utf8');
const code = fs.readFileSync('assets/homesplit/personal-view.js', 'utf8');
function setup(nativeDialog = true) {
  const dom = new JSDOM(html, {url:'http://127.0.0.1:8796/pricing/personal/', runScripts:'outside-only'});
  const w = dom.window;
  w.fetch = () => { throw new Error('Unexpected network request'); };
  if (nativeDialog) {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  } else w.HTMLDialogElement.prototype.showModal = undefined;
  w.eval(code);
  return {dom, w, d:w.document};
}
test('every mobile plan retains table content, links and maintenance promises without changing the original', () => {
  const {dom, d} = setup();
  const table = d.querySelector('#personal-comparison');
  const cards = [...d.querySelectorAll('.comparison-cards article')];
  assert.equal(cards.length, 3);
  const before = new JSDOM(html).window.document.querySelector('#personal-comparison');
  assert.equal(table.outerHTML, before.outerHTML);
  cards.forEach((card, i) => {
    assert.equal(card.querySelector('h3').textContent, table.tHead.rows[0].cells[i+1].textContent);
    [...card.querySelectorAll('dd')].forEach((value, j) => assert.equal(value.innerHTML, table.tBodies[0].rows[j].cells[i+1].innerHTML));
  });
  dom.window.close();
});
test('review viewer loads the local screenshot, zooms, restores scroll and returns focus', () => {
  const {dom, w, d} = setup();
  const links = [...d.querySelectorAll('.personal-review-image')];
  const dialog = d.querySelector('#review-dialog');
  d.body.style.overflow = 'auto';
  for (const link of links) {
    link.focus();
    const event = new w.MouseEvent('click', {bubbles:true,cancelable:true});
    assert.equal(link.dispatchEvent(event), false);
    assert.equal(dialog.open, true);
    assert.equal(dialog.querySelector('img').src, link.href);
    assert.equal(new URL(dialog.querySelector('img').src).origin, w.location.origin);
    assert.equal(d.body.style.overflow, 'hidden');
    const zoom = dialog.querySelector('[data-review-zoom]');
    zoom.click();assert.equal(zoom.getAttribute('aria-pressed'), 'true');
    dialog.querySelector('[data-review-close]').click();
    assert.equal(dialog.open, false);
    assert.equal(zoom.getAttribute('aria-pressed'), 'false');
    assert.equal(d.body.style.overflow, 'auto');
    assert.equal(d.activeElement, link);
  }
  assert.equal(w.localStorage.length, 0);assert.equal(w.sessionStorage.length, 0);
  dom.window.close();
});
test('browsers without modal support retain local image links and responsive cards', () => {
  const {dom, d} = setup(false);
  assert.equal(d.querySelectorAll('.comparison-cards article').length, 3);
  for (const link of d.querySelectorAll('.personal-review-image')) {
    assert.match(link.getAttribute('href'), /^\/assets\/reviews\/review_\d+\.webp$/);
    assert.equal(link.hasAttribute('target'), false);
  }
  dom.window.close();
});
