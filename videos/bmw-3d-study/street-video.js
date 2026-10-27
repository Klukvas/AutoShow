import { STREET_RATE, streetScale } from './street-dynamics.js?v=static-camera-1';

const DURATION = 5;
const SOURCE = new URL('./assets/v5-motion-clean-street/arrival-preview.mp4', import.meta.url).href;
const FIRST = new URL('./assets/v5-motion-clean-street/first-frame.jpg', import.meta.url).href;
const SETTLED = new URL('./assets/v5-motion-clean-street/settled.jpg', import.meta.url).href;

export function createStreetVideo({ stage, iframe, reducedMotion, fixedTime, onTime, onReady, onFallback, shouldAutoplay }) {
  const video = document.createElement('video');
  video.id = 'street-video'; video.muted = true; video.playsInline = true;
  video.defaultPlaybackRate = STREET_RATE; video.playbackRate = STREET_RATE;
  video.preload = 'auto'; video.poster = FIRST; video.setAttribute('aria-hidden', 'true');
  const still = document.createElement('img');
  still.className = 'settled-poster'; still.alt = 'Графітовий BMW M4 на міській вулиці';
  still.width = 896; still.height = 504; still.hidden = true;
  const opening = document.createElement('img');
  opening.className = 'opening-poster'; opening.alt = '';
  opening.width = 896; opening.height = 504; opening.hidden = reducedMotion.matches;
  opening.setAttribute('aria-hidden', 'true'); opening.src = FIRST;
  stage.prepend(video, opening, still); iframe.remove();
  let manualStill = false, callback = 0, ready = false, initialHandled = false, pendingPlay = false, pendingSeek = null;
  let playRequest = 0;
  function emit(time) {
    const clamped = Math.max(0, Math.min(DURATION, Number.isFinite(time) ? time : 0));
    const scale = `scale(${streetScale(clamped, reducedMotion.matches)})`;
    for (const surface of [video, opening, still]) {
      surface.style.transformOrigin = '70% 62%';
      surface.style.transform = scale;
    }
    onTime(clamped);
  }
  function markReady() { if (!ready) { ready = true; onReady(); } }
  function stopTick() {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback); else cancelAnimationFrame(callback);
    callback = 0;
  }
  function tick() {
    if (!manualStill) opening.hidden = true;
    emit(manualStill ? 5 : video.currentTime);
    if (video.paused || video.ended || manualStill) return;
    callback = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function settle(message = '') {
    playRequest += 1;
    manualStill = true; pendingPlay = false; stopTick(); video.pause(); video.hidden = true;
    still.hidden = false; opening.hidden = still.complete && still.naturalWidth > 0;
    emit(5); onFallback(message);
  }
  function pause() { playRequest += 1; stopTick(); video.pause(); emit(manualStill ? 5 : video.currentTime); }
  function seek(time) {
    if (reducedMotion.matches) { settle(); return; }
    const target = Math.max(0, Math.min(DURATION, Number.isFinite(time) ? time : 0));
    if (target === DURATION) { settle(); return; }
    if (video.readyState < 1) { pendingSeek = target; return; }
    manualStill = false; still.hidden = true; video.hidden = false;
    video.currentTime = Math.min(target, Number.isFinite(video.duration) ? video.duration : DURATION);
    emit(video.currentTime);
  }
  async function start() {
    if (reducedMotion.matches) { settle(); return; }
    manualStill = false; still.hidden = true; video.hidden = false;
    video.playbackRate = STREET_RATE;
    const request = ++playRequest;
    try {
      await video.play();
      if (request !== playRequest || manualStill) return;
      stopTick();
      if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(tick);
      else callback = requestAnimationFrame(tick);
    } catch {
      if (request === playRequest) settle('Показуємо кадр автомобіля. Каталог доступний.');
    }
  }
  function replay() {
    if (reducedMotion.matches) { settle(); return; }
    playRequest += 1; stopTick(); video.pause();
    manualStill = false; pendingPlay = true; pendingSeek = 0;
    opening.hidden = false; still.hidden = true; video.hidden = false; emit(0);
    // Reloading also recovers a native video surface that stopped repainting.
    video.src = SOURCE; video.load();
  }
  still.addEventListener('load', () => { if (manualStill) { opening.hidden = true; markReady(); } });
  still.addEventListener('error', () => { markReady(); onFallback('Каталог доступний нижче.'); });
  video.addEventListener('loadeddata', () => {
    markReady();
    if (manualStill || reducedMotion.matches) return;
    if (pendingSeek !== null) { seek(pendingSeek); pendingSeek = null; }
    if (pendingPlay) { pendingPlay = false; start(); return; }
    if (initialHandled) return;
    initialHandled = true;
    if (fixedTime !== null) { pause(); seek(fixedTime); }
    else if (shouldAutoplay()) start(); else settle();
  });
  for (const event of ['timeupdate', 'seeked', 'pause']) video.addEventListener(event, () => emit(manualStill ? 5 : video.currentTime));
  video.addEventListener('seeked', () => {
    if (manualStill || opening.hidden) return;
    // A paused WebKit seek may present before a newly registered frame callback.
    if (video.paused && video.readyState >= 2) { opening.hidden = true; return; }
    stopTick();
    callback = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  });
  video.addEventListener('ended', () => settle());
  video.addEventListener('error', () => settle('Показуємо кадр автомобіля. Каталог доступний.'));
  addEventListener('pagehide', pause);
  const restoreTerminalImage = () => { if (video.ended || video.currentTime >= DURATION) settle(); };
  addEventListener('pageshow', restoreTerminalImage);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') restoreTerminalImage(); });
  still.src = SETTLED;
  if (reducedMotion.matches) settle(); else { video.src = SOURCE; video.load(); }
  return { video, still, pause, seek, replay, settle, getTime: () => manualStill ? 5 : video.currentTime };
}
