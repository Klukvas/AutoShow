const film = document.querySelector('#film');
const play = document.querySelector('#play');
const replay = document.querySelector('#replay');
const scrubber = document.querySelector('#scrubber');
const timeLabel = document.querySelector('#time');
const reset = document.querySelector('#reset');
const hint = document.querySelector('#hint');
let isReady = false;
let isPlaying = false;
let time = 5;
let startedAt = 0;
let frameRequest = 0;
function send(action, value) { film.contentWindow.postMessage({ source: 'bmw-viewer', action, time: value }, location.origin); }
function update() {
  scrubber.value = String(time);
  timeLabel.value = `${time.toFixed(2)} / 5.00`;
  play.textContent = isPlaying ? 'Пауза' : time >= 5 ? 'Відтворити' : 'Продовжити';
  play.setAttribute('aria-label', isPlaying ? 'Пауза' : time >= 5 ? 'Відтворити' : 'Продовжити');
}
function pause() {
  isPlaying = false; cancelAnimationFrame(frameRequest); send('playing', false); update();
}
function seek(next) { time = Math.max(0, Math.min(5, next)); send('seek', time); update(); }
function tick(timestamp) {
  if (!isPlaying) return;
  seek((timestamp - startedAt) / 1000);
  if (time >= 5) pause(); else frameRequest = requestAnimationFrame(tick);
}
function start(fromBeginning = false) {
  if (!isReady) return;
  if (fromBeginning || time >= 5) seek(0);
  isPlaying = true; send('playing', true); startedAt = performance.now() - time * 1000;
  update(); frameRequest = requestAnimationFrame(tick);
}
play.addEventListener('click', () => isPlaying ? pause() : start());
replay.addEventListener('click', () => { pause(); start(true); });
scrubber.addEventListener('input', () => { const nextTime = Number(scrubber.value); pause(); seek(nextTime); });
reset.addEventListener('click', () => { pause(); send('reset'); seek(5); });
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== film.contentWindow || event.data?.source !== 'bmw-stage') return;
  if (event.data.action === 'ready') {
    isReady = true; for (const control of [play, replay, scrubber, reset]) control.disabled = false;
    hint.textContent = '5 секунд · Колеса й гальма — окрема геометрія · Огляд на паузі'; seek(5);
  }
  if (event.data.action === 'error') { pause(); hint.textContent = 'Не вдалося показати 3D-сцену. Оновіть сторінку.'; }
});
film.addEventListener('load', () => send('hello'));
