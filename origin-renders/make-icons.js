// Usage: node make-icons.js <path-to-your-website-folder>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || 'icons';
const MARK = `
  <g stroke="#E8692D" stroke-width="11">
    <line x1="29.2" y1="38" x2="15.4" y2="30"/>
    <line x1="26" y1="50" x2="10" y2="50"/>
    <line x1="29.2" y1="62" x2="15.4" y2="70"/>
  </g>
  <path d="M42 20.1 A31 31 0 1 1 42 79.9" fill="none" stroke="#F3EFE8" stroke-width="18"/>`;
const tile = size => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#070707"/>
    <g transform="translate(50 50) scale(0.72) translate(-50 -50)">${MARK}</g>
  </svg>`;
const files = [
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size] of files) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${tile(size)}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(out, name) });
  }
  await browser.close();
  console.log('Icons saved to', out);
})();