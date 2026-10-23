import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('mark3d');
const hero = document.querySelector('.hero');
const hint = document.querySelector('.scroll-hint');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (webglAvailable()) init();
else document.documentElement.classList.add('no-webgl');

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // Logo geometry, built from the same coordinates as the SVG logo (viewBox 0–100, centre 50,50)
  const U = 0.055, D = 12 * U, deg = Math.PI / 180;
  const extrude = { depth: D, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 72 };

  // The ring: an arc with its opening on the left
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
  const ring = new THREE.Mesh(ringGeo, ringMat);
  logo.add(ring);

  // The three orange segments: their home position, plus where they float before assembling
  const segLines = [[-20.8, 12, -34.6, 20], [-24, 0, -40, 0], [-20.8, -12, -34.6, -20]];
  const scatter = [[-1.7, 1.3, 1.3], [-2.3, -0.1, 0.4], [-1.5, -1.4, -0.6]];
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

  // Lights: soft studio environment, a key light, and an orange glow that grows as the logo completes
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 6);
  scene.add(key);
  const glow = new THREE.PointLight(0xE8692D, 0);
  glow.position.set(-2.5, -0.5, 2.5);
  scene.add(glow);

  // Sizing
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, 13 / Math.min(camera.aspect, 1));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Scroll + pointer
  let target = 0, prog = reduce ? 1 : 0, mx = 0, my = 0, tmx = 0, tmy = 0, visible = true;
  const scrollProgress = () => {
    const r = hero.getBoundingClientRect();
    const total = Math.max(1, (hero.offsetHeight - window.innerHeight) * 0.85);
    return Math.min(1, Math.max(0, -r.top / total));
  };
  window.addEventListener('scroll', () => { target = scrollProgress(); }, { passive: true });
  target = scrollProgress();
  window.addEventListener('pointermove', e => { tmx = e.clientX / window.innerWidth - 0.5; tmy = e.clientY / window.innerHeight - 0.5; }, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const start = performance.now();
  let first = true;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - start) / 1000;
    if (!reduce) {
      prog += (target - prog) * 0.08;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
    }
    const a = reduce ? 1 : ease(prog);   // 0 = floating apart, 1 = assembled
    const loose = 1 - a;

    logo.rotation.y = loose * -0.65 + mx * 0.35 + (reduce ? 0 : Math.sin(t * 0.35) * 0.05 * a);
    logo.rotation.x = loose * 0.28 + my * 0.25;
    logo.position.x = loose * 0.35;

    segs.forEach(m => {
      const u = m.userData;
      const bob = reduce ? 0 : Math.sin(t * 1.1 + u.phase) * 0.12 * loose;
      const wobble = reduce ? 0 : Math.sin(t * 0.6 + u.phase) * 0.25 * loose;
      m.position.copy(u.home).addScaledVector(u.away, loose);
      m.position.y += bob;
      m.rotation.set(u.spin.x * loose + wobble, u.spin.y * loose, u.homeRot + u.spin.z * loose);
    });

    glow.intensity = a * a * 30;
    if (hint) hint.style.opacity = String(Math.max(0, 1 - prog * 3));

    renderer.render(scene, camera);
    if (first) { canvas.classList.add('ready'); first = false; }
  }
  requestAnimationFrame(frame);
}