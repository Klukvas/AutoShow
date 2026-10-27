import test from 'node:test';
import assert from 'node:assert/strict';
import { createStreetVideo } from '../street-video.js';

class Surface extends EventTarget {
  constructor(tag) {
    super(); this.tagName = tag; this.style = {}; this.hidden = false;
    this.currentTime = 0; this.duration = 5; this.readyState = 0;
    this.paused = true; this.ended = false; this.complete = tag === 'img';
    this.naturalWidth = tag === 'img' ? 896 : 0; this.loadCount = 0; this.frames = new Map(); this.nextFrame = 0;
    this.playQueue = [];
  }
  setAttribute() {}
  load() { this.loadCount += 1; this.readyState = 0; this.currentTime = 0; this.ended = false; }
  play() { this.paused = false; return this.playQueue.shift() ?? Promise.resolve(); }
  pause() { this.paused = true; }
  requestVideoFrameCallback(callback) { this.frames.set(++this.nextFrame, callback); return this.nextFrame; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  present() { const callbacks = [...this.frames.values()]; this.frames.clear(); for (const callback of callbacks) callback(0, { mediaTime: this.currentTime }); }
  event(name) { this.dispatchEvent(new Event(name)); }
}
function fixture({ reduce = false, autoplay = true, fixedTime = null } = {}) {
  const elements = [];
  globalThis.document = { visibilityState: 'visible', createElement(tag) { const surface = new Surface(tag); elements.push(surface); return surface; }, addEventListener() {} };
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const times = [], fallbacks = [];
  const controller = createStreetVideo({ stage: { prepend() {} }, iframe: { remove() {} },
    reducedMotion: { matches: reduce }, fixedTime,
    onTime: time => times.push(time), onReady() {}, onFallback: message => fallbacks.push(message), shouldAutoplay: () => autoplay });
  return { ...controller, elements, times, fallbacks,
    async ready() { controller.video.readyState = 4; controller.video.event('loadeddata'); await Promise.resolve(); } };
}

test('opening image remains available until an actual video frame is presented', async () => {
  const app = fixture();
  const opening = app.elements.find(element => element.className === 'opening-poster');
  assert.ok(opening && !opening.hidden, 'loading has a visible first-frame image');
  await app.ready();
  assert.equal(opening.hidden, false, 'metadata alone does not establish a painted video frame');
  app.video.present();
  assert.equal(opening.hidden, true);
});

test('ended switches to loaded settled image instead of depending on retained native video paint', async () => {
  const app = fixture(); await app.ready(); app.video.present();
  app.video.currentTime = 5; app.video.ended = true; app.video.paused = true;
  app.video.event('ended');
  assert.equal(app.still.hidden, false);
  assert.equal(app.video.hidden, true);
  assert.equal(app.elements.find(element => element.className === 'opening-poster').hidden, true);
  assert.match(app.still.src, /settled.jpg$/);
  assert.equal(app.still.style.transform, 'scale(1)');
  assert.equal(app.getTime(), 5);
});

test('Replay reloads the native decoder and retains opening image until fresh presentation', async () => {
  const app = fixture(); await app.ready(); app.video.present();
  const before = app.video.loadCount;
  app.replay();
  assert.equal(app.video.loadCount, before + 1);
  const opening = app.elements.find(element => element.className === 'opening-poster');
  assert.ok(opening && !opening.hidden);
  assert.equal(opening.style.transform, 'scale(1)');
  await app.ready(); app.video.present();
  assert.equal(app.video.style.transform, 'scale(1)');
  assert.equal(opening.hidden, true);
  assert.equal(app.video.playbackRate, 1.3);
});

test('reduced motion remains a static unzoomed image and never loads video', () => {
  const app = fixture({ reduce: true });
  assert.equal(app.video.loadCount, 0);
  assert.equal(app.still.hidden, false);
  assert.equal(app.still.style.transform, 'scale(1)');
  app.replay();
  assert.equal(app.video.loadCount, 0);
});

test('paused fixed-time seek reveals decoded pose on seeked without a later video-frame callback', async () => {
  const app = fixture({ fixedTime: 1.25 });
  await app.ready();
  assert.equal(app.video.paused, true);
  assert.equal(app.video.currentTime, 1.25);
  const opening = app.elements.find(element => element.className === 'opening-poster');
  assert.equal(opening.hidden, false);
  app.video.event('seeked');
  assert.equal(opening.hidden, true);
  assert.equal(app.video.paused, true);
  assert.equal(app.getTime(), 1.25);
});

test('late media readiness after catalog settling cannot restart autoplay', async () => {
  const app = fixture();
  app.settle(); await app.ready();
  assert.equal(app.video.paused, true);
  assert.equal(app.video.hidden, true);
  assert.equal(app.still.hidden, false);
  assert.equal(app.getTime(), 5);
});

test('stale play rejection cannot replace a newer successful Replay with a fallback', async () => {
  const app = fixture();
  let rejectOld;
  app.video.playQueue.push(new Promise((resolve, reject) => { rejectOld = reject; }));
  await app.ready();
  app.replay(); await app.ready(); app.video.present();
  rejectOld(new Error('Old play request was interrupted'));
  await Promise.resolve();
  assert.equal(app.video.hidden, false);
  assert.equal(app.still.hidden, true);
  assert.equal(app.fallbacks.length, 0);
});
