const byId = id => document.getElementById(id);
const panels = { exteriors: byId('exterior-studio'), model: byId('model-panel'), location: byId('neighborhood-panel') };
let mode = '';
let locationView;
let locationTask;

async function showMode(next) {
  if (!panels[next] || mode === next) return;
  if (mode === 'model') document.dispatchEvent(new Event('ssc:hide-model'));
  mode = next;
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== next;
  for (const button of document.querySelectorAll('#studio-nav button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === next));
  }
  locationView?.setActive?.(next === 'location');
  if (next === 'model') await import('./app.js?v=fast-2');
  if (next === 'location') {
    if (!locationTask) {
      panels.location.textContent = 'Preparing the neighborhood map…';
      locationTask = import('./neighborhood.js?v=new-blender-1').then(async module => {
        panels.location.replaceChildren();
        return module.mountNeighborhood(panels.location);
      });
    }
    try {
      locationView = await locationTask;
      locationView?.setActive?.(mode === 'location');
      if (mode === 'location') locationView?.resize?.();
    } catch (error) {
      locationTask = null;
      panels.location.textContent = 'The 3D location could not load. Switch views and try again.';
      console.error(error);
    }
  }
}

for (const button of document.querySelectorAll('#studio-nav button')) {
  button.onclick = () => {
    const next = button.dataset.mode;
    history.replaceState(null, '', '#' + next);
    showMode(next);
  };
}
byId('open-plan-picker').addEventListener('click', () => {
  document.querySelector('#studio-nav [data-mode="model"]').click();
}, true);
const initialMode = () => showMode(panels[location.hash.slice(1)] ? location.hash.slice(1) : 'model');
window.addEventListener('hashchange', initialMode);
initialMode();

const photo = byId('studio-photo');
const surface = byId('photo-surface');
const indexNav = byId('render-list');
let rows = [], current = 0, detail = false, panX = 0, panY = 0, drag = null;
let photoRevision = 0;
async function showPhotoFile(file) {
  const revision = ++photoRevision;
  if (photo.getAttribute('src') === file) return;
  const next = new Image();
  next.decoding = 'async';
  next.src = file;
  try {
    await next.decode();
    if (revision !== photoRevision) return;
    photo.src = file;
    positionPhoto();
  } catch (error) { console.warn('Keeping the current exterior image.', error); }
}
const number = index => String(index + 1).padStart(2, '0');
function positionPhoto() {
  if (!photo.naturalWidth || !photo.naturalHeight || !surface.clientWidth) return;
  const fit = Math.min(surface.clientWidth / photo.naturalWidth, surface.clientHeight / photo.naturalHeight);
  const scale = detail ? 2.35 : 1;
  const boundX = Math.max(0, (photo.naturalWidth * fit * scale - surface.clientWidth) / 2) || 0;
  const boundY = Math.max(0, (photo.naturalHeight * fit * scale - surface.clientHeight) / 2) || 0;
  panX = Math.max(-boundX, Math.min(boundX, panX));
  panY = Math.max(-boundY, Math.min(boundY, panY));
  photo.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
}
function setDetail(enabled) {
  detail = enabled;
  const row = rows[current];
  if (row) {
    const file = detail || document.fullscreenElement || surface.clientWidth * window.devicePixelRatio > row.previewWidth ? row.src : row.preview;
    showPhotoFile(file);
  }
  panX = panY = 0;
  surface.classList.toggle('inspecting', detail);
  byId('photo-zoom').textContent = detail ? 'Fit full building' : 'Inspect detail';
  byId('photo-zoom').setAttribute('aria-pressed', String(detail));
  positionPhoto();
}
function selectPhoto(index) {
  if (!rows.length) return;
  current = (index + rows.length) % rows.length;
  const row = rows[current];
  photo.alt = row.description || row.title;
  byId('photo-title').textContent = row.title;
  byId('photo-description').textContent = row.description;
  byId('photo-index').textContent = 'VIEW ' + number(current) + ' / ' + String(rows.length).padStart(2, '0') + '   ·   ARCHITECTURAL RENDER';
  byId('original-photo').href = row.sourceUrl || row.src;
  for (const [i, button] of [...indexNav.children].entries()) button.setAttribute('aria-pressed', String(i === current));
  setDetail(false);
}
async function loadCollection() {
  const response = await fetch('assets/exteriors/views.json');
  if (!response.ok) throw Error('Exterior collection unavailable');
  rows = await response.json();
  for (const [i, row] of rows.entries()) {
    const button = document.createElement('button');
    const thumb = document.createElement('img');
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    thumb.src = row.thumb;
    thumb.alt = '';
    const label = document.createElement('span');
    const serial = document.createElement('small');
    serial.textContent = 'VIEW ' + number(i);
    label.append(serial, row.title);
    button.append(thumb, label);
    button.onclick = () => selectPhoto(i);
    indexNav.append(button);
  }
  selectPhoto(0);
}
const collectionObserver = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  collectionObserver.disconnect();
  loadCollection().catch(error => {
    byId('photo-description').textContent = 'The exterior collection could not load. Refresh to try again.';
    console.error(error);
  });
});
collectionObserver.observe(panels.exteriors);
photo.addEventListener('load', positionPhoto);
new ResizeObserver(positionPhoto).observe(surface);
byId('prev-photo').onclick = () => selectPhoto(current - 1);
byId('next-photo').onclick = () => selectPhoto(current + 1);
byId('photo-zoom').onclick = () => setDetail(!detail);
surface.ondblclick = () => setDetail(!detail);
surface.onkeydown = event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    selectPhoto(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
};
surface.onpointerdown = event => {
  if (!detail) return;
  drag = { x: event.clientX, y: event.clientY, panX, panY };
  surface.setPointerCapture(event.pointerId);
};
surface.onpointermove = event => {
  if (!drag) return;
  panX = drag.panX + event.clientX - drag.x;
  panY = drag.panY + event.clientY - drag.y;
  positionPhoto();
};
surface.onpointerup = surface.onpointercancel = () => { drag = null; };
byId('photo-fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await surface.parentElement.requestFullscreen();
  } catch { window.open(photo.src, '_blank', 'noopener'); }
};
document.addEventListener('fullscreenchange', () => setDetail(detail));

async function openReferences() {
  const dialog = byId('references');
  const list = dialog.querySelector('.reference-switch');
  if (!list.dataset.ready) {
    const response = await fetch('assets/references.json');
    const references = await response.json();
    for (const n of [1, 2]) references.push({ title: 'Commercial floor plan ' + n, src: 'assets/plans/commercial-' + n + '.webp' });
    list.replaceChildren();
    for (const row of references) {
      const button = document.createElement('button');
      button.textContent = row.title;
      button.onclick = () => {
        byId('reference-image').src = row.src;
        byId('reference-image').alt = row.title;
        byId('reference-detail').href = row.src;
        byId('reference-detail').textContent = 'Open reference image ↗';
        for (const other of list.children) other.setAttribute('aria-pressed', String(other === button));
      };
      list.append(button);
    }
    list.firstElementChild?.click();
    list.dataset.ready = 'true';
  }
  dialog.showModal();
}
byId('open-reference').onclick = openReferences;
byId('close-reference').onclick = () => byId('references').close();

