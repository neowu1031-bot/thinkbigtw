/* Decorative connections follow the actual HTML layout, including mobile reflow. */
(function () {
  'use strict';
  const diagram = document.querySelector('.mcp-network');
  if (!diagram) return;
  const map = diagram.querySelector('.mcp-network-map');
  const svg = diagram.querySelector('.mcp-connections');
  const hub = diagram.querySelector('.mcp-hub');
  const agents = [...diagram.querySelectorAll('.mcp-agent')];
  const toolNodes = [...diagram.querySelectorAll('.mcp-tool')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 760px)');
  const ns = 'http://www.w3.org/2000/svg';
  const edges = [...agents, ...toolNodes].map((node, i) => {
    const wire = document.createElementNS(ns, 'path');
    const pulse = document.createElementNS(ns, 'path');
    [wire, pulse].forEach((path, j) => {
      path.setAttribute('class', j ? 'mcp-pulse' : 'mcp-wire');
      path.setAttribute('pathLength', '1');
      path.style.setProperty('--edge', i);
      svg.appendChild(path);
    });
    return {node, wire, pulse, tool: i >= agents.length};
  });
  let frame = 0, inView = false;
  function draw() {
    frame = 0;
    const box = map.getBoundingClientRect();
    if (!box.width || !box.height) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const point = node => {
      const r = node.getBoundingClientRect();
      return {x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, left: r.left - box.left};
    };
    const h = point(hub);
    const bus = point(toolNodes[0]).y - toolNodes[0].getBoundingClientRect().height / 2 - 14;
    edges.forEach(({node, wire, pulse, tool}) => {
      const p = point(node);
      const d = mobile.matches
        ? `M ${h.x} ${h.y} H 12 V ${p.y} H ${p.left}`
        : tool ? `M ${h.x} ${h.y} V ${bus} H ${p.x} V ${p.y}` : `M ${p.x} ${p.y} L ${h.x} ${h.y}`;
      wire.setAttribute('d', d); pulse.setAttribute('d', d);
    });
  }
  const schedule = () => {if (!frame) frame = window.requestAnimationFrame(draw);};
  const playback = () => diagram.classList.toggle('mcp-running', inView && !document.hidden && !reduced.matches);
  const preference = () => {
    // Once reduced motion is selected, keep the content visible when it is disabled again.
    if (reduced.matches) diagram.classList.add('mcp-entered');
    playback();
  };
  draw();
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(map);
  else window.addEventListener('resize', schedule, {passive: true});
  mobile.addEventListener('change', schedule);
  reduced.addEventListener('change', preference);
  document.addEventListener('visibilitychange', playback);
  if ('IntersectionObserver' in window) {
    diagram.classList.add('mcp-ready');
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) diagram.classList.add('mcp-entered');
      playback();
    }, {threshold: 0});
    observer.observe(diagram);
  } else {
    diagram.classList.add('mcp-entered');
  }
  preference();
})();
