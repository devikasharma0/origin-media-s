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

  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('yr').textContent = new Date().getFullYear();
})();