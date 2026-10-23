import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isDesktop = matchMedia('(min-width: 901px)').matches;

const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));

const webgl = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
})();

const pointer = { x: 0, y: 0 };
addEventListener('pointermove', e => {
  pointer.x = e.clientX / innerWidth - 0.5;
  pointer.y = e.clientY / innerHeight - 0.5;
}, { passive: true });

// ---------- Shared 3D helpers ----------
const U = 0.055, D = 12 * U, deg = Math.PI / 180;

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  return r;
}
function addEnvironment(renderer, scene) {
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}
function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function barGeometry(len, w, depth, bevel) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -w / 2); s.lineTo(len / 2, -w / 2); s.lineTo(len / 2, w / 2); s.lineTo(-len / 2, w / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const segMaterial = () => new THREE.MeshPhysicalMaterial({ color: 0xE8692D, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 });
const ringMaterial = () => new THREE.MeshPhysicalMaterial({ color: 0xF3EFE8, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });

const SEG_LINES = [[-20.8, 12, -34.6, 20], [-24, 0, -40, 0], [-20.8, -12, -34.6, -20]];
function buildLogo(scatter) {
  const group = new THREE.Group();
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 40 * U, 105 * deg, -105 * deg, true);
  ring.absarc(0, 0, 22 * U, -105 * deg, 105 * deg, false);
  ring.closePath();
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: D, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 72 });
  ringGeo.translate(0, 0, -D / 2);
  group.add(new THREE.Mesh(ringGeo, ringMaterial()));
  const mat = segMaterial();
  const segs = SEG_LINES.map(([x1, y1, x2, y2], i) => {
    const m = new THREE.Mesh(barGeometry(Math.hypot(x2 - x1, y2 - y1) * U, 11 * U, D, 0.035), mat);
    m.userData = {
      home: new THREE.Vector3(((x1 + x2) / 2) * U, ((y1 + y2) / 2) * U, 0),
      homeRot: Math.atan2(y2 - y1, x2 - x1),
      away: new THREE.Vector3(...scatter[i]),
      spin: new THREE.Vector3(0.9 + i * 0.5, -0.7 + i * 0.6, 1.3 - i * 1.1),
    };
    group.add(m);
    return m;
  });
  return { group, segs };
}
function fitCamera(canvas, renderer, camera, fit, yOff) {
  const f = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, yOff, fit / Math.min(camera.aspect, 1));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(f).observe(canvas);
  f();
}
function onScreen(el) {
  const s = { visible: false };
  new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(el);
  return s;
}

// ---------- Services: segments rearrange for each service ----------
function servicesScene() {
  const canvas = document.getElementById('services3d');
  if (!canvas || !webgl || !isDesktop) return null;
  const renderer = makeRenderer(canvas), scene = new THREE.Scene();
  addEnvironment(renderer, scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  fitCamera(canvas, renderer, camera, 7, 0.5);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);

  // Soft contact shadow so the object sits on the page
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({
    map: radialTexture(128, [[0, 'rgba(60,30,10,0.32)'], [1, 'rgba(60,30,10,0)']]), transparent: true, depthWrite: false, toneMapped: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.9;
  scene.add(shadow);

  // [x, y, z, rotation] for each of the three segments
  const CONF = [
    { bars: [[0, 0.95, 0.3, 0], [0, 0, 0, 0], [0, -0.95, -0.3, 0]], tilt: [0.35, -0.55] },                      // brands: a feed of posts
    { bars: [[-0.62, 0.78, 0, -0.785], [0, -0.3, 0.15, Math.PI / 2], [0.62, 0.78, 0, 0.785]], tilt: [0.15, 0.3] }, // personal: a figure standing out
    { bars: [[-0.19, 0.8, 0, -0.52], [-0.4, 0, 0.2, 0], [-0.19, -0.8, 0, 0.52]], tilt: [0.2, -0.25] },             // campaigns: broadcast rays
  ];

  const group = new THREE.Group();
  scene.add(group);
  const geo = barGeometry(1.7, 0.5, 0.5, 0.05), mat = segMaterial();
  const details = [...document.querySelectorAll('.service')];
  let ci = Math.max(0, details.findIndex(d => d.open));
  const bars = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(geo, mat);
    const [x, y, z, r] = CONF[ci].bars[i];
    m.position.set(x, y, z);
    m.rotation.z = r;
    m.userData.flip = 0;
    group.add(m);
    return m;
  });

  details.forEach((d, i) => d.addEventListener('toggle', () => {
    if (!d.open) return;
    details.forEach(o => { if (o !== d && o.open) o.open = false; });
    if (i !== ci) { ci = i; bars.forEach(b => { b.userData.flip += Math.PI; }); }
  }));

  const vis = onScreen(canvas);
  let gx = CONF[ci].tilt[0], gy = CONF[ci].tilt[1];

  return {
    update(dt, t) {
      if (!vis.visible) return;
      const c = CONF[ci];
      bars.forEach((b, i) => {
        const [x, y, z, r] = c.bars[i];
        const l = reduce ? 60 : 5.5 - i * 1.2;   // each segment moves a little later than the last
        b.position.set(damp(b.position.x, x, l, dt), damp(b.position.y, y, l, dt), damp(b.position.z, z, l, dt));
        b.rotation.z = damp(b.rotation.z, r, l, dt);
        b.rotation.x = reduce ? b.userData.flip : damp(b.rotation.x, b.userData.flip, l * 0.8, dt);
      });
      gx = damp(gx, c.tilt[0] + pointer.y * 0.25, 3, dt);
      gy = damp(gy, c.tilt[1] + pointer.x * 0.35, 3, dt);
      group.rotation.set(gx, gy + (reduce ? 0 : Math.sin(t * 0.4) * 0.08), 0);
      group.position.y = reduce ? 0 : Math.sin(t * 0.9) * 0.08;
      shadow.scale.setScalar(1 - group.position.y * 0.6);
      renderer.render(scene, camera);
    },
  };
}

// ---------- Contact: the logo assembles again as a bookend ----------
function contactScene() {
  const canvas = document.getElementById('contact3d');
  const section = document.getElementById('contact');
  if (!canvas || !section || !webgl) return null;
  const renderer = makeRenderer(canvas), scene = new THREE.Scene();
  addEnvironment(renderer, scene);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  fitCamera(canvas, renderer, camera, 12.5, 0);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-3, 4, 6);
  scene.add(key);

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({
    map: radialTexture(256, [[0, 'rgba(255,255,255,0.5)'], [0.35, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]),
    color: 0xE8692D, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  halo.position.z = -1.4;
  scene.add(halo);

  const { group: logo, segs } = buildLogo([[-1.6, 1.2, 1.2], [-2.1, 0, 0.5], [-1.4, -1.3, -0.6]]);
  scene.add(logo);
  const vis = onScreen(canvas);
  let p = reduce ? 1 : 0;

  return {
    update(dt, t) {
      if (!vis.visible) return;
      const r = section.getBoundingClientRect();
      const target = clamp01((innerHeight - r.top) / (innerHeight * 0.85));
      if (!reduce) p = damp(p, target, 4, dt);
      const a = ease(p), loose = 1 - a;
      segs.forEach((m, i) => {
        const u = m.userData;
        const li = 1 - (reduce ? 1 : ease(clamp01((p - i * 0.12) / 0.76)));
        m.position.copy(u.home).addScaledVector(u.away, li);
        m.rotation.set(u.spin.x * li, u.spin.y * li, u.homeRot + u.spin.z * li);
      });
      logo.rotation.y = loose * -0.6 + pointer.x * 0.3 + (reduce ? 0 : Math.sin(t * 0.35) * 0.18 * a);
      logo.rotation.x = loose * 0.25 + pointer.y * 0.2;
      logo.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.05;
      halo.material.opacity = 0.1 + 0.35 * a * a;
      renderer.render(scene, camera);
    },
  };
}

// ---------- Belief statement: rises out of depth ----------
const stmt = document.querySelector('.statement p');
let stmtP = 0;
function updateStatement(dt) {
  if (!stmt || reduce) return;
  const r = stmt.getBoundingClientRect(), vh = innerHeight;
  if (r.bottom < -100 || r.top > vh + 100) return;
  stmtP = damp(stmtP, clamp01((vh * 0.92 - r.top) / (vh * 0.6)), 6, dt);
  const e = ease(stmtP);
  stmt.style.transform = `rotateX(${((1 - e) * 24).toFixed(2)}deg) translateY(${((1 - e) * 48).toFixed(1)}px)`;
  stmt.style.opacity = (0.2 + 0.8 * e).toFixed(3);
}

// ---------- Cards tilt toward the cursor ----------
const tilts = [];
if (canHover && !reduce) {
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

// ---------- One loop for everything ----------
const services = servicesScene();
const contact = contactScene();
let last = performance.now(), t = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  updateStatement(dt);
  updateTilts(dt);
  if (services) services.update(dt, t);
  if (contact) contact.update(dt, t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);