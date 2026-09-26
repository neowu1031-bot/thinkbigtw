/* Local-only review viewer and responsive plan comparison. No network or storage. */
(function () {
  'use strict';
  const table = document.getElementById('personal-comparison');
  if (table) {
    const cards = document.createElement('div');
    cards.className = 'comparison-cards';
    cards.setAttribute('aria-label', '三階方案比較');
    const rows = Array.from(table.tBodies[0].rows);
    Array.from(table.tHead.rows[0].cells).slice(1).forEach((header, index) => {
      const card = document.createElement('article');
      const title = document.createElement('h3');
      title.textContent = header.textContent;
      card.append(title);
      const list = document.createElement('dl');
      rows.forEach(row => {
        const item = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = row.cells[0].textContent === 'CTA' ? '查看方案' : row.cells[0].textContent;
        const value = document.createElement('dd');
        // Clone only authored local table content, retaining links and emphasis.
        Array.from(row.cells[index + 1].childNodes).forEach(node => value.append(node.cloneNode(true)));
        item.append(label, value);
        list.append(item);
      });
      card.append(list);
      cards.append(card);
    });
    table.parentElement.after(cards);
    table.parentElement.classList.add('comparison-enhanced');
  }

  const dialog = document.getElementById('review-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const picture = dialog.querySelector('img');
  const zoom = dialog.querySelector('[data-review-zoom]');
  const viewport = dialog.querySelector('.review-dialog-viewport');
  let opener;
  let previousOverflow;
  function resetZoom() {
    dialog.classList.remove('is-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = '原尺寸檢視';
    viewport.scrollTop = viewport.scrollLeft = 0;
  }
  document.querySelectorAll('.personal-review-image').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      const source = link.querySelector('img');
      picture.src = source.src;
      picture.alt = source.alt;
      picture.width = source.width;
      picture.height = source.height;
      dialog.querySelector('.review-dialog-caption').textContent = source.alt;
      resetZoom();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    });
  });
  zoom.addEventListener('click', () => {
    const expanded = dialog.classList.toggle('is-zoomed');
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.textContent = expanded ? '符合視窗' : '原尺寸檢視';
  });
  dialog.querySelector('[data-review-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow || '';
    resetZoom();
    opener?.focus();
  });
})();
