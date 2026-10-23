// Usage: node export-carousel.js clips/file.html out/folder [light]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const [, , input, outDir = 'out/carousel', theme] = process.argv;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 3200, height: 1000 }, deviceScaleFactor: 3 });
  await page.goto('file://' + path.resolve(input));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  if (theme === 'light') await page.click('[data-t="1"]');
  fs.mkdirSync(outDir, { recursive: true });
  const slides = await page.$$('.slide');
  for (let i = 0; i < slides.length; i++) {
    await slides[i].screenshot({ path: path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
  console.log(`Saved ${slides.length} slides to ${outDir}`);
})();
