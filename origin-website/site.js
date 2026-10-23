(function () {
  // ---------- Add your work here when it's ready ----------
  // While these lists are empty, the site shows the "first case studies" message instead.
  const PROJECTS = [
    // { title: 'Diwali launch campaign', client: 'Brand name', type: 'Campaign', summary: 'One line on the result.', image: 'images/work/brand.jpg', url: '#' },
  ];
  const CLIENTS = [
    // { name: 'Brand name', logo: 'images/clients/brand.svg' },
  ];

  const grid = document.getElementById('work-grid');
  const empty = document.getElementById('work-empty');
  if (PROJECTS.length) {
    empty.hidden = true;
    grid.innerHTML = PROJECTS.map(p => `
      <a class="work-card" href="${p.url || '#'}">
        <div class="img"><img src="${p.image}" alt="${p.title} for ${p.client}" loading="lazy"></div>
        <h3>${p.title}</h3>
        <p>${p.client}, ${p.type}. ${p.summary}</p>
      </a>`).join('');
  } else {
    grid.hidden = true;
  }

  if (CLIENTS.length) {
    document.getElementById('clients').hidden = false;
    document.getElementById('client-list').innerHTML = CLIENTS
      .map(c => `<li><img src="${c.logo}" alt="${c.name}" loading="lazy"></li>`).join('');
  }

  // ---------- Header background after scrolling ----------
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('yr').textContent = new Date().getFullYear();

  // ---------- 3D touches outside the hero ----------
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));

  // Belief line rises out of depth as it scrolls into view
  const stmt = document.querySelector('.statement p');
  let stmtP = 0;
  function updateStatement(dt) {
    if (!stmt) return;
    const r = stmt.getBoundingClientRect(), vh = window.innerHeight;
    if (r.bottom < -100 || r.top > vh + 100) return;
    stmtP = damp(stmtP, clamp01((vh * 0.92 - r.top) / (vh * 0.6)), 6, dt);
    const e = ease(stmtP);
    stmt.style.transform = `rotateX(${((1 - e) * 24).toFixed(2)}deg) translateY(${((1 - e) * 48).toFixed(1)}px)`;
    stmt.style.opacity = (0.2 + 0.8 * e).toFixed(3);
  }

  // Cards tilt toward the cursor (mouse devices only)
  const tilts = [];
  if (canHover) {
    document.querySelectorAll('.steps li, .work-empty, .work-card').forEach(el => {
      el.classList.add('tilt');
      const s = { el, rx: 0, ry: 0, hl: 0, trx: 0, try: 0, thl: 0 };
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        s.try = (px - 0.5) * 7;
        s.trx = -(py - 0.5) * 7;
        s.thl = 1;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => { s.trx = 0; s.try = 0; s.thl = 0; });
      tilts.push(s);
    });
  }
  function updateTilts(dt) {
    tilts.forEach(s => {
      s.rx = damp(s.rx, s.trx, 8, dt);
      s.ry = damp(s.ry, s.try, 8, dt);
      s.hl = damp(s.hl, s.thl, 8, dt);
      s.el.style.transform = (Math.abs(s.rx) < 0.01 && Math.abs(s.ry) < 0.01)
        ? '' : `perspective(900px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`;
      s.el.style.setProperty('--hl', s.hl.toFixed(3));
    });
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateStatement(dt);
    updateTilts(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();