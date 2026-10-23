import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Lenis from 'lenis';
// ---------- Tuning ----------
const CONFIG = {
  startDelay: 0.5,    // seconds after load before the segments start moving
  assembleTime: 1.8,  // how long each segment takes to land
  stagger: 0.25,      // delay between the three segments
  logoFit: 17,        // higher = smaller logo
  dustDesktop: 140,
  dustMobile: 70,
};

const canvas = document.getElementById('mark3d');
const hero = document.querySelector('.hero');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 900px)').matches;
// ---------- Smooth scrolling ----------
// lerp: lower = smoother and floatier (0.07), higher = snappier (0.15)
if (!reduce) {
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]:not(.skip)').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: id === '#top' ? 0 : -72, duration: 1.2 });
    });
  });
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
if (webglAvailable()) init();
else document.documentElement.classList.add('no-webgl');

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

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // ---------- Logo (same coordinates as the SVG logo) ----------
  const U = 0.055, D = 12 * U, deg = Math.PI / 180;
  const extrude = { depth: D, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 72 };

  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, 40 * U, 105 * deg, -105 * deg, true);
  ringShape.absarc(0, 0, 22 * U, -105 * deg, 105 * deg, false);
  ringShape.closePath();
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, extrude);
  ringGeo.translate(0, 0, -D / 2);

  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0xF3EFE8, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  const segMat = new THREE.MeshPhysicalMaterial({ color: 0xE8692D, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25 });

  const logo = new THREE.Group();
  scene.add(logo);
  logo.add(new THREE.Mesh(ringGeo, ringMat));

  const segLines = [[-20.8, 12, -34.6, 20], [-24, 0, -40, 0], [-20.8, -12, -34.6, -20]];
  const scatter = [[-1.2, 1.0, 1.0], [-1.7, -0.1, 0.4], [-1.1, -1.1, -0.5]];
  const segs = segLines.map(([x1, y1, x2, y2], i) => {
    const len = Math.hypot(x2 - x1, y2 - y1) * U, w = 11 * U;
    const s = new THREE.Shape();
    s.moveTo(-len / 2, -w / 2); s.lineTo(len / 2, -w / 2); s.lineTo(len / 2, w / 2); s.lineTo(-len / 2, w / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { ...extrude, curveSegments: 4 });
    g.translate(0, 0, -D / 2);
    const m = new THREE.Mesh(g, segMat);
    m.userData = {
      home: new THREE.Vector3(((x1 + x2) / 2) * U, ((y1 + y2) / 2) * U, 0),
      homeRot: Math.atan2(y2 - y1, x2 - x1),
      away: new THREE.Vector3(...scatter[i]),
      spin: new THREE.Vector3(0.9 + i * 0.5, -0.7 + i * 0.6, 1.3 - i * 1.1),
      phase: i * 2.1,
    };
    logo.add(m);
    return m;
  });

  // ---------- Lights ----------
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const glow = new THREE.PointLight(0xE8692D, 0);
  glow.position.set(-2.5, -0.5, 2.5);
  scene.add(glow);

  // ---------- Halo behind the logo ----------
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({
      map: radialTexture(256, [[0, 'rgba(255,255,255,0.55)'], [0.35, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]),
      color: 0xE8692D, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    })
  );
  halo.renderOrder = -1;
  scene.add(halo);

  // ---------- Floating dust ----------
  const N = isMobile ? CONFIG.dustMobile : CONFIG.dustDesktop;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cPaper = new THREE.Color(0xF3EFE8), cOrange = new THREE.Color(0xE8692D);
  for (let i = 0; i < N; i++) {
    const r = 2.6 + Math.random() * 3.2, th = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * r;
    pos[i * 3 + 1] = Math.sin(th) * r * 0.75;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    const c = Math.random() < 0.2 ? cOrange : cPaper;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: isMobile ? 0.05 : 0.04,
    map: radialTexture(64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]),
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  scene.add(dust);

  // ---------- Lock-in pulse ----------
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(2.25, 2.29, 128),
    new THREE.MeshBasicMaterial({ color: 0xE8692D, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  );
  scene.add(pulse);

  // ---------- Sizing ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, CONFIG.logoFit / Math.min(camera.aspect, 1));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Input ----------
  let mx = 0, my = 0, tmx = 0, tmy = 0, sp = 0, visible = true;
  window.addEventListener('pointermove', e => {
    tmx = e.clientX / window.innerWidth - 0.5;
    tmy = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));

  let last = performance.now(), t = 0, first = true, pulseT = -1, pulsed = false;

  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    t += dt;

    mx = damp(mx, tmx, 3, dt);
    my = damp(my, tmy, 3, dt);
    sp = damp(sp, reduce ? 0 : clamp01(window.scrollY / window.innerHeight), 6, dt);

    // Each segment lands on its own schedule, one after another
    const amounts = segs.map((m, i) => reduce ? 1 : ease(clamp01((t - CONFIG.startDelay - i * CONFIG.stagger) / CONFIG.assembleTime)));
    const avg = (amounts[0] + amounts[1] + amounts[2]) / 3;
    const done = amounts[2];
    const intro = reduce ? 1 : 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);

    logo.scale.setScalar(0.92 + 0.08 * intro);
    logo.position.set(0.15 + 0.25 * (1 - avg), (reduce ? 0 : Math.sin(t * 0.8) * 0.04) + sp * 1.4, 0);
    logo.rotation.y = (1 - avg) * -0.55 + mx * 0.3 + (reduce ? 0 : Math.sin(t * 0.3) * 0.06 * avg) + sp * 0.5;
    logo.rotation.x = (1 - avg) * 0.25 + my * 0.2 - sp * 0.15;

    segs.forEach((m, i) => {
      const u = m.userData, loose = 1 - amounts[i];
      m.position.copy(u.home).addScaledVector(u.away, loose);
      if (!reduce) m.position.y += Math.sin(t * 1.1 + u.phase) * 0.1 * loose;
      m.rotation.set(u.spin.x * loose, u.spin.y * loose, u.homeRot + u.spin.z * loose);
    });

    key.position.x = reduce ? -3 : -3 + Math.sin(t * 0.2) * 3;   // slow light sweep
    glow.intensity = done * done * 30;

    halo.position.set(logo.position.x, logo.position.y, -1.4);
    halo.material.opacity = (0.12 + 0.5 * done * done) * intro;

    dust.rotation.y = (reduce ? 0 : t * 0.025) + mx * 0.25;
    dust.rotation.x = my * 0.18;
    dust.position.y = sp * 0.7;
    dust.material.opacity = 0.55 * intro;

    // One pulse when the last segment locks in
    if (!reduce && !pulsed && done > 0.985) { pulsed = true; pulseT = 0; }
    if (pulseT >= 0) {
      pulseT += dt;
      const k = pulseT / 1.3;
      pulse.scale.setScalar(1 + k * 0.8);
      pulse.material.opacity = (1 - k) * 0.6;
      if (k >= 1) { pulseT = -1; pulse.material.opacity = 0; }
    }
    pulse.position.set(logo.position.x, logo.position.y, 0.4);

    renderer.render(scene, camera);
    if (first) { canvas.classList.add('ready'); first = false; }
  });
}