const film = document.querySelector('#hero-film');
const replay = document.querySelector('#replay-hero');
const cover = document.querySelector('#scene-cover');
const sceneStatus = document.querySelector('#scene-status');
const cards = [...document.querySelectorAll('.car-card')];
const cardParts = cards.map(card => ({
  skeleton: card.parentElement.querySelector('.card-skeleton'),
  photo: card.querySelector('.car-photo'),
  viewport: card.querySelector('.car-photo-viewport'),
  text: [...card.querySelectorAll('.car-title, .specs, .card-bottom')]
}));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isStreet = new URLSearchParams(location.search).get('environment') === 'street';
const sceneURL = new URL(film.dataset.src, location.href);
if (!isStreet) film.src = sceneURL.href;
if (isStreet) { document.documentElement.dataset.environment = 'street'; document.querySelector('.hero-stage').setAttribute('aria-label', 'Графітовий BMW M4 на міській вулиці'); }
const requestedTime = new URLSearchParams(location.search).get('time');
const fixedTime = requestedTime !== null && Number.isFinite(Number(requestedTime)) ? Math.max(0, Math.min(5, Number(requestedTime))) : null;
const dialog = document.querySelector('#details-dialog');
const dialogContent = document.querySelector('#dialog-content');
const menuToggle = document.querySelector('#menu-toggle');
const navigation = document.querySelector('#main-nav');
let isReady = false;
let isPlaying = false;
let frameRequest = 0;
let startTime = 0;
let prefersBrowsing = false;
let lastFocused = null;
let currentTime = 0;
let streetVideo = null;

function send(action, time) { if (!isStreet) film.contentWindow?.postMessage({ source: 'bmw-viewer', action, time }, location.origin); }
function updateCards(time) {
  cards.forEach((card, index) => {
    if (isStreet) {
      const pose = streetCardPose(time, index, reducedMotion.matches || prefersBrowsing);
      card.style.opacity = String(pose.opacity);
      card.style.transform = `translateY(${pose.y}px) scale(${pose.scale})`;
      card.style.visibility = pose.visible ? 'visible' : 'hidden';
      card.style.pointerEvents = pose.interactive ? 'auto' : 'none';
      card.inert = !pose.interactive;
      card.setAttribute('aria-hidden', String(!pose.interactive));
      const parts = cardParts[index];
      parts.skeleton.style.opacity = String(pose.skeletonOpacity);
      parts.skeleton.style.visibility = pose.skeletonOpacity > 0 ? 'visible' : 'hidden';
      parts.photo.style.clipPath = `inset(0 0 ${pose.photoInset}% 0)`;
      parts.viewport.style.transform = `scale(${pose.photoScale})`;
      parts.text.forEach((row, rowIndex) => {
        row.style.opacity = String(pose.text[rowIndex].opacity);
        row.style.transform = `translateY(${pose.text[rowIndex].y}px)`;
      });
      return;
    }
    const progress = reducedMotion.matches || prefersBrowsing ? 1 : Math.max(0, Math.min(1, (time - index * 0.2) / 0.5));
    const eased = 1 - (1 - progress) ** 3;
    card.style.opacity = String(eased);
    card.style.transform = `translateY(${16 * (1 - eased)}px)`;
    card.style.visibility = progress > 0 ? 'visible' : 'hidden';
    card.style.pointerEvents = progress >= 1 ? 'auto' : 'none';
    card.inert = progress < 1;
    card.setAttribute('aria-hidden', String(progress < 1));
  });
}
function seek(time) { if (isStreet) { streetVideo?.seek(time); return; } currentTime = time; send('seek', time); updateCards(time); document.documentElement.dataset.sceneTime = time.toFixed(3); }
function pause() { isPlaying = false; cancelAnimationFrame(frameRequest); if (isStreet) streetVideo?.pause(); else send('playing', true); }
function tick(timestamp) {
  if (!isPlaying) return;
  seek(Math.min(5, (timestamp - startTime) / 1000));
  if (currentTime < 5) frameRequest = requestAnimationFrame(tick); else pause();
}
function play() {
  if (!isReady) return;
  if (isStreet) { prefersBrowsing = false; streetVideo?.replay(); return; }
  pause(); prefersBrowsing = false;
  if (reducedMotion.matches) { seek(5); return; }
  seek(0); isPlaying = true; startTime = performance.now(); frameRequest = requestAnimationFrame(tick);
}
function showFallback(message) {
  if (isStreet) { streetVideo?.settle(message); return; }
  pause(); prefersBrowsing = true; updateCards(5);
  sceneStatus.textContent = message; cover.hidden = false; cover.classList.add('is-fallback');
}
function closeMenu() { navigation.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded', 'false'); }
function browseCatalog(event) {
  event?.preventDefault(); prefersBrowsing = true; pause(); seek(5); closeMenu();
  if (isStreet) streetVideo?.settle();
  const heading = document.querySelector('#catalog-heading');
  heading.focus({ preventScroll: true });
  document.querySelector('#catalog').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
}
function openDialog(title, body) {
  lastFocused = document.activeElement;
  dialogContent.replaceChildren();
  const heading = document.createElement('h2'); heading.id = 'dialog-title'; heading.textContent = title;
  dialogContent.append(heading, ...body); dialog.showModal(); closeMenu();
}
function paragraph(text, className) { const element = document.createElement('p'); element.textContent = text; if (className) element.className = className; return element; }
const vehicles = {
  bmw: { name: 'BMW 530i', price: '$32 900', year: '2019', mileage: '82 000 км', fuel: 'Бензин' },
  audi: { name: 'Audi A6', price: '$29 500', year: '2018', mileage: '96 000 км', fuel: 'Дизель' },
  mercedes: { name: 'Mercedes-Benz C200', price: '$28 900', year: '2020', mileage: '64 000 км', fuel: 'Бензин' }
};
function showVehicle(key) {
  const vehicle = vehicles[key]; if (!vehicle) return;
  const specs = document.createElement('dl'); specs.className = 'dialog-specs';
  for (const [label, value] of [['Рік', vehicle.year], ['Пробіг', vehicle.mileage], ['Пальне', vehicle.fuel]]) {
    const group = document.createElement('div'), term = document.createElement('dt'), description = document.createElement('dd');
    term.textContent = label; description.textContent = value; group.append(term, description); specs.append(group);
  }
  openDialog(vehicle.name, [paragraph('Демонстраційна пропозиція', 'demo-label'), paragraph(vehicle.price, 'dialog-price'), specs, paragraph('Це приклад картки автомобіля. Фото, ціна та характеристики показані для ознайомлення; пропозиція не є актуальним оголошенням.', 'dialog-note')]);
}
for (const link of document.querySelectorAll('[data-catalog]')) link.addEventListener('click', browseCatalog);
for (const button of document.querySelectorAll('[data-detail]')) button.addEventListener('click', () => showVehicle(button.dataset.detail));
for (const button of document.querySelectorAll('[data-info]')) button.addEventListener('click', () => {
  if (button.dataset.info === 'about') openDialog('Про AutoFlow', [paragraph('AutoFlow — простір для вибору наступного авто. Тут можна порівняти моделі, характеристики та ціни.'), paragraph('Зараз ви переглядаєте демонстрацію першого екрана. Показані автомобілі — приклади для ознайомлення.', 'dialog-note')]);
  else openDialog('Контакти', [paragraph('Контактні дані з’являться в повній версії AutoFlow.'), paragraph('Ця демонстрація не приймає заявки. Ви можете переглянути приклади авто й ознайомитися з їхніми характеристиками.', 'dialog-note')]);
});
menuToggle.addEventListener('click', () => { const isOpen = navigation.classList.toggle('is-open'); menuToggle.setAttribute('aria-expanded', String(isOpen)); });
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  const isHiddenNavInvoker = lastFocused instanceof HTMLElement && navigation.contains(lastFocused) && navigation.getClientRects().length === 0;
  const returnTarget = isHiddenNavInvoker ? menuToggle : lastFocused;
  returnTarget?.focus();
});
dialog.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
replay.addEventListener('click', play);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { pause(); if (isStreet) streetVideo?.settle(); else seek(5); } });
addEventListener('message', event => {
  if (isStreet) return;
  if (event.origin !== location.origin || event.source !== film.contentWindow || event.data?.source !== 'bmw-stage') return;
  if (event.data.action === 'ready' && !isReady) {
    isReady = true; clearTimeout(loadNotice); clearTimeout(loadTimeout); replay.disabled = false; cover.classList.remove('is-fallback'); cover.hidden = true;
    send('playing', true);
    if (reducedMotion.matches || prefersBrowsing) seek(5); else if (fixedTime !== null) seek(fixedTime); else play();
  }
  if (event.data.action === 'error') showFallback('Авто не завантажилося. Обрані пропозиції доступні нижче.');
});
film.addEventListener('load', () => send('hello'));
const loadNotice = setTimeout(() => { if (!isReady) sceneStatus.textContent = 'Завантажуємо авто. Каталог уже доступний.'; }, 8000);
const loadTimeout = setTimeout(() => { if (!isReady) showFallback('Авто завантажується довше, ніж зазвичай. Обрані пропозиції доступні нижче.'); }, 30000);
document.documentElement.classList.add('is-animating'); updateCards(reducedMotion.matches ? 5 : fixedTime ?? 0);
import { createStreetVideo } from './street-video.js?v=static-camera-1';
import { streetCardPose } from './street-dynamics.js?v=static-camera-1';

if (isStreet) {
  const videoStatus = document.createElement('p');
  videoStatus.className = 'visually-hidden'; videoStatus.setAttribute('role', 'status');
  document.querySelector('.hero-stage').append(videoStatus);
  streetVideo = createStreetVideo({ stage: document.querySelector('.hero-stage'), iframe: film,
    reducedMotion, fixedTime, shouldAutoplay: () => !prefersBrowsing,
    onTime(time) { currentTime = time; updateCards(time); document.documentElement.dataset.sceneTime = time.toFixed(3); },
    onReady() { isReady = true; clearTimeout(loadNotice); clearTimeout(loadTimeout); replay.disabled = false; cover.hidden = true; },
    onFallback(message) { isReady = true; prefersBrowsing = true; updateCards(5); cover.hidden = true; videoStatus.textContent = message; replay.disabled = false; }
  });
  window.__streetHero = streetVideo;
}
