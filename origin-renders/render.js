// Usage: npm run render -- clips/name.html out/name.mp4 [seconds] [fps] [light]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [, , input, output = 'out/video.mp4', secs = '15', fpsArg = '60', theme] = process.argv;
const duration = Number.parseFloat(secs);
const fps = Number.parseInt(fpsArg, 10);
const scale = 3;

if (!input) {
  console.error('Usage: npm run render -- clips/name.html [out/name.mp4] [seconds] [fps] [light]');
  process.exit(1);
}

if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(fps) || fps <= 0) {
  console.error('Duration and FPS must be positive numbers.');
  process.exit(1);
}

const inputPath = path.resolve(input);
const outputPath = path.resolve(output);
if (!fs.existsSync(inputPath)) {
  console.error(`Input clip not found: ${inputPath}`);
  process.exit(1);
}

const framesDir = path.resolve('frames');

function audioVoices(type, pitch = 659) {
  switch (type) {
    case 'tick':
      return [
        { frequency: pitch, duration: 0.2, volume: 0.14 },
        { frequency: pitch * 2, duration: 0.12, volume: 0.035 },
      ];
    case 'note':
      return [{ frequency: pitch, duration: 0.38, volume: 0.075 }];
    case 'chord':
      return [
        { frequency: 392, duration: 1.1, volume: 0.09 },
        { frequency: 494, duration: 0.95, volume: 0.06 },
        { frequency: 587, duration: 0.8, volume: 0.04 },
      ];
    case 'chime':
      return [
        { frequency: 392, duration: 1.1, volume: 0.08, fadeIn: 0.008 },
        { frequency: 587, duration: 0.95, volume: 0.045, fadeIn: 0.008 },
        { frequency: 784, duration: 0.8, volume: 0.025, fadeIn: 0.008 },
      ];
    default:
      throw new Error(`Unsupported audio cue type: ${type}`);
  }
}

function addAudioOutput(args, cues, audioDuration) {
  if (!Array.isArray(cues)) {
    throw new Error('RENDER_AUDIO_CUES must be an array.');
  }

  const voices = [];
  for (const [index, cue] of cues.entries()) {
    if (
      !cue ||
      typeof cue !== 'object' ||
      !Number.isFinite(cue.time) ||
      cue.time < 0 ||
      cue.time >= audioDuration ||
      typeof cue.type !== 'string' ||
      (cue.pitch !== undefined && (!Number.isFinite(cue.pitch) || cue.pitch < 80 || cue.pitch > 2000))
    ) {
      throw new Error(`Invalid audio cue at index ${index}. Each cue needs a supported type and a time within the clip.`);
    }
    voices.push(...audioVoices(cue.type, cue.pitch).map(voice => ({ ...voice, time: cue.time })));
  }

  if (voices.length === 0) {
    return;
  }

  const graph = [];
  for (const [index, voice] of voices.entries()) {
    const duration = Math.min(voice.duration, audioDuration - voice.time);
    const source = `sine=frequency=${voice.frequency}:duration=${duration}:sample_rate=44100`;
    args.push('-f', 'lavfi', '-i', source);

    const fadeIn = Math.min(voice.fadeIn ?? 0.004, duration / 2);
    const fadeOut = Math.min(0.12, duration);
    const filters = [
      `volume=${voice.volume}`,
      `afade=t=in:st=0:d=${fadeIn}`,
      `afade=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}`,
      `adelay=${Math.round(voice.time * 1000)}|${Math.round(voice.time * 1000)}`,
    ];
    graph.push(`[${index + 1}:a]${filters.join(',')}[cue${index}]`);
  }

  const labels = voices.map((_, index) => `[cue${index}]`).join('');
  graph.push(`${labels}amix=inputs=${voices.length}:duration=longest:normalize=0,volume=8,alimiter=limit=0.9,apad,atrim=duration=${audioDuration}[audio]`);
  args.push(
    '-filter_complex', graph.join(';'),
    '-map', '0:v:0',
    '-map', '[audio]',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', String(audioDuration),
  );
}

(async () => {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch();
  let audioCues = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 1400 },
      deviceScaleFactor: scale,
    });

    await page.addInitScript(() => {
      let now = 1;
      const queue = [];
      performance.now = () => now;
      window.requestAnimationFrame = callback => {
        queue.push(callback);
        return queue.length;
      };
      window.__step = ms => {
        now = ms + 1;
        queue.splice(0).forEach(callback => callback(now));
      };
    });

    await page.goto(pathToFileURL(inputPath).href);
    await page.addStyleTag({ content: '#fr{border-radius:0!important;transition:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    audioCues = await page.evaluate(() => window.RENDER_AUDIO_CUES ?? []);
    await page.waitForTimeout(1500);

    if (theme === 'light' && await page.$('[data-t="1"]')) {
      await page.click('[data-t="1"]');
    }
    await page.click('#rp');

    const frame = await page.$('#fr');
    if (!frame) {
      throw new Error('Clip must contain an element with id="fr".');
    }

    const total = Math.round(duration * fps);
    for (let i = 0; i < total; i++) {
      const time = (i * 1000) / fps;
      await page.evaluate(t => {
        document.getAnimations().forEach(animation => {
          animation.pause();
          animation.currentTime = t;
        });
        window.__step(t);
      }, time);
      await frame.screenshot({
        path: path.join(framesDir, `f${String(i).padStart(5, '0')}.png`),
      });
      if (i % fps === 0) {
        console.log(`Rendered ${i / fps}s of ${duration}s`);
      }
    }
  } finally {
    await browser.close();
  }

  const total = Math.round(duration * fps);
  const ffmpegArgs = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'f%05d.png'),
  ];
  addAudioOutput(ffmpegArgs, audioCues, total / fps);
  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '14',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  );
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
  console.log('Done:', outputPath);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
