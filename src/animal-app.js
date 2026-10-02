import { drawScene, getTimelineDuration, MOTION_GRAPHIC_PRESETS } from './modules/scene.js?v=18';
import { generateVideo } from './modules/video-export.js?v=2';
import { ANIMALS, loadAnimalImage } from './animals.js';

const app = document.querySelector('#app');
const playback = { currentTime: 0, playing: false, startAt: 0, frame: 0 };
const exportState = { generating: false, url: null };

const project = {
  background: null,
  characters: ANIMALS.map(([name, sizeMeters], index) => ({
    id: crypto.randomUUID(),
    name,
    sizeMeters,
    goals: sizeMeters,
    matches: index + 1,
    image: null,
    position: { x: 0, y: 0 },
    renderedDimensions: { width: 0, height: 0 },
    details: [
      { id: crypto.randomUUID(), label: 'Maximum length', value: `${sizeMeters} m`, image: null },
      { id: crypto.randomUUID(), label: 'Rank', value: `#${index + 1}`, image: null },
      { id: crypto.randomUUID(), label: 'Comparison', value: 'Living animal', image: null },
    ],
    league: { name: 'Size comparison', emblem: null },
    animation: { emphasis: 1 },
  })),
  settings: {
    cameraSpeed: 1,
    displayDuration: 2.5,
    transitionDuration: 1.5,
    zoomStrength: 0.62,
    characterSpacing: 1150,
    detailAnimation: 'draw',
    characterHighlight: 'soft-glow',
    motionGraphics: 'none',
    clubNameColor: '#ffffff',
    detailsColor: '#f6f9ff',
    fontFamily: 'system-ui, sans-serif',
  },
  selectedId: null,
  sortDirection: 'desc',
};

project.selectedId = project.characters[0]?.id ?? null;

const motionGraphicOptions = ['<option value="none">None</option>', ...[...new Set(MOTION_GRAPHIC_PRESETS.map((preset) => preset.family))].map((family) =>
  `<optgroup label="${family}">${MOTION_GRAPHIC_PRESETS.filter((preset) => preset.family === family).map((preset) =>
    `<option value="${preset.id}">${preset.family} · ${preset.palette.name}</option>`,
  ).join('')}</optgroup>`,
)].join('');

app.innerHTML = `
  <div class="studio-app">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Animal Size Comparison home"><span class="brand-mark">A</span>Animal<span class="brand-light">Size Comparison</span></a>
      <div class="topbar-actions"><span class="save-state"><i></i> 100 animals</span><button class="button button-primary" data-action="sort-toggle">Descending ↓</button></div>
    </header>
    <main class="workspace">
      <aside class="sidebar">
        <section class="side-section project-settings">
          <div class="section-heading"><div><p class="eyebrow">PROJECT SETUP</p><h2>Background</h2></div><span class="section-number">01</span></div>
          <div id="background-preview" class="background-preview"><span>16:9 scene background</span></div>
          <div class="button-row"><label class="button button-secondary" for="background-file">Upload Background</label><button class="icon-button" data-action="remove-background">×</button></div>
          <input class="sr-only" id="background-file" type="file" accept="image/png,image/jpeg,image/webp" />
          <p class="field-hint">Optional PNG, JPG, or WebP background.</p>
        </section>
        <section class="side-section character-section">
          <div class="section-heading"><div><p class="eyebrow">TOP 100 ANIMALS</p><h2>Animals <span id="character-count" class="muted-count">100</span></h2></div></div>
          <div id="character-list" class="character-list"></div>
          <div id="character-editor" class="character-editor"></div>
        </section>
      </aside>
      <section class="main-column">
        <div class="welcome-row"><div><p class="eyebrow">LIVING ANIMAL SIZE · MAXIMUM LENGTH</p><h1>Compare the world's largest animals.</h1><p class="welcome-copy">100 animals ranked by representative maximum total length. Use the button above to switch between descending and ascending order.</p></div><div class="workflow-pill"><span>01</span> Size comparison</div></div>
        <section class="stage-panel">
          <div class="stage-heading"><div><p class="eyebrow">LIVE SCENE</p><h2 id="active-label">Loading animal images…</h2></div><div class="stage-badge"><span class="live-dot"></span><span id="phase-label">Preparing 100 images</span></div></div>
          <div class="canvas-frame"><canvas id="scene-canvas" width="1920" height="1080" aria-label="Animal size comparison animation"></canvas><div class="canvas-corner">16:9</div></div>
          <div class="timeline-controls"><div class="transport"><button class="transport-button" data-action="restart">↺</button><button class="play-button" data-action="toggle-play"><span id="play-icon">▶</span><span id="play-label">Play Preview</span></button></div><div class="scrubber-wrap"><input id="timeline-scrubber" type="range" min="0" max="1" step="0.01" value="0"><div class="time-readout"><span id="current-time">0:00</span><span id="total-time">0:00</span></div></div></div>
        </section>
        <section class="settings-panel">
          <div class="section-heading settings-title"><div><p class="eyebrow">MOTION & FRAMING</p><h2>Animation settings</h2></div><span class="settings-note">Shared by preview and video</span></div>
          <div class="settings-grid">
            <label class="range-field"><span>Camera speed <output id="camera-speed-value">1.0×</output></span><input data-setting="cameraSpeed" type="range" min="0.5" max="2" step="0.1" value="1"></label>
            <label class="range-field"><span>Animal hold <output id="display-duration-value">2.5 sec</output></span><input data-setting="displayDuration" type="range" min="1" max="8" step="0.5" value="2.5"></label>
            <label class="range-field"><span>Transition <output id="transition-duration-value">1.5 sec</output></span><input data-setting="transitionDuration" type="range" min="0.5" max="5" step="0.5" value="1.5"></label>
            <label class="range-field"><span>Camera zoom <output id="zoom-strength-value">Balanced</output></span><input data-setting="zoomStrength" type="range" min="0.42" max="0.78" step="0.02" value="0.62"></label>
            <label class="range-field"><span>Animal spacing <output id="spacing-value">1,150</output></span><input data-setting="characterSpacing" type="range" min="800" max="1800" step="50" value="1150"></label>
            <label class="select-field"><span>Detail entrance</span><select data-setting="detailAnimation"><option value="draw">Draw border</option><option value="fade">Fade in</option><option value="slide-up">Slide up</option><option value="rise-fade">Rise + fade</option><option value="zoom">Zoom in</option><option value="wipe">Top-down reveal</option><option value="spring">Spring pop</option><option value="slide-left">Slide from left</option><option value="name-then-slide">Name first, details slide down</option><option value="callouts">Connected callouts</option></select></label>
            <label class="select-field"><span>Animal highlight</span><select data-setting="characterHighlight"><option value="none">None</option><option value="soft-glow">Soft glow</option><option value="cyan-aura">Cyan aura</option><option value="gold-aura">Gold aura</option><option value="spotlight">Spotlight</option><option value="pulse">Pulse</option><option value="bounce">Bounce</option><option value="halo">Halo ring</option><option value="rays">Light rays</option><option value="sparkles">Sparkles</option><option value="shimmer">Moving shimmer</option><option value="color-pop">Color pop</option><option value="focus">Focus stage</option></select></label>
            <label class="select-field"><span>Motion graphics <small>100 presets</small></span><select data-setting="motionGraphics">${motionGraphicOptions}</select></label>
            <label class="select-field"><span>Name color</span><input data-setting="clubNameColor" type="color" value="#ffffff"></label>
            <label class="select-field"><span>Details color</span><input data-setting="detailsColor" type="color" value="#f6f9ff"></label>
            <label class="select-field"><span>Font style</span><select data-setting="fontFamily"><option value="system-ui, sans-serif">System</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="Courier New, monospace">Monospace</option></select></label>
            <label class="select-field"><span>Download format</span><select id="export-format"><option value="mp4" selected>MP4</option><option value="webm">WebM</option></select></label>
            <label class="select-field"><span>Video resolution</span><select id="export-resolution"><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option></select></label>
            <label class="select-field"><span>Frame rate</span><select id="export-fps"><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
          </div>
        </section>
        <section class="export-panel">
          <div class="export-copy"><div class="export-icon">▶</div><div><p class="eyebrow">BROWSER VIDEO EXPORT</p><h2>Make the animal comparison video</h2><p>Uses the same Canvas-based animation pipeline as the original project.</p></div></div>
          <button id="generate-video" class="button button-primary generate-button" data-action="generate-video">Generate Video <span>↗</span></button>
          <div id="export-progress" class="export-progress" hidden><div class="progress-copy"><span id="progress-label">Preparing video…</span><span id="progress-value">0%</span></div><div class="progress-track"><span id="progress-fill"></span></div></div>
          <p id="export-message" class="export-message" role="status"></p><div id="video-result" class="video-result" hidden></div>
        </section>
        <footer class="footer"><span>Animal Size Comparison</span><span>Top 100 · maximum-length snapshot</span></footer>
      </section>
    </main>
  </div>`;

const canvas = document.querySelector('#scene-canvas');
const characterList = document.querySelector('#character-list');
const editor = document.querySelector('#character-editor');
const notice = document.querySelector('#export-message');

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }
function selectedCharacter() { return project.characters.find((c) => c.id === project.selectedId) ?? null; }
function formatTime(seconds) { const value = Math.max(0, Math.floor(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }
function setNotice(message, error = false) { notice.textContent = message; notice.classList.toggle('is-error', error); }

function sortedCharacters() {
  return [...project.characters].sort((a, b) => project.sortDirection === 'desc' ? b.sizeMeters - a.sizeMeters : a.sizeMeters - b.sizeMeters);
}

function applySort() {
  const ordered = sortedCharacters();
  project.characters.splice(0, project.characters.length, ...ordered);
  project.characters.forEach((character, index) => { character.details[0].value = `${character.sizeMeters} m`; character.details[1].value = `#${index + 1}`; });
}

function renderCharacterList() {
  document.querySelector('#character-count').textContent = project.characters.length;
  characterList.innerHTML = project.characters.map((character, index) => `<div class="character-list-row ${character.id === project.selectedId ? 'is-selected' : ''}"><button class="character-select" data-action="select-character" data-id="${character.id}"><span class="list-index">${String(index + 1).padStart(2, '0')}</span><span class="list-avatar">${character.image ? `<img src="${character.image.url}" alt="">` : '◌'}</span><span class="list-name">${escapeHtml(character.name)}</span></button><span class="list-index">${character.sizeMeters} m</span></div>`).join('');
}

function assetMarkup(asset) { return asset ? `<div class="asset-preview"><img src="${asset.url}" alt="${escapeHtml(asset.name)}"><span>${asset.width} × ${asset.height}</span></div>` : '<div class="asset-placeholder"><span>◌</span>Loading animal image…</div>'; }

function renderEditor() {
  const character = selectedCharacter();
  if (!character) { editor.innerHTML = ''; return; }
  const index = project.characters.indexOf(character) + 1;
  editor.innerHTML = `<div class="editor-heading"><div><p class="eyebrow">ANIMAL ${String(index).padStart(2,'0')}</p><h3>${escapeHtml(character.name)}</h3></div></div><div class="field-block"><span class="field-label">Animal image</span>${assetMarkup(character.image)}</div><div class="detail-list">${character.details.map((detail) => `<article class="detail-card"><div class="detail-card-top"><span class="detail-number">•</span></div><label class="text-field"><span>${escapeHtml(detail.label)}</span><input value="${escapeHtml(detail.value)}" readonly></label></article>`).join('')}</div>`;
}

function renderSettingsValues() {
  document.querySelector('#camera-speed-value').textContent = `${Number(project.settings.cameraSpeed).toFixed(1)}×`;
  document.querySelector('#display-duration-value').textContent = `${project.settings.displayDuration} sec`;
  document.querySelector('#transition-duration-value').textContent = `${project.settings.transitionDuration} sec`;
  document.querySelector('#zoom-strength-value').textContent = Number(project.settings.zoomStrength) < 0.52 ? 'Wide' : Number(project.settings.zoomStrength) > 0.70 ? 'Close' : 'Balanced';
  document.querySelector('#spacing-value').textContent = Number(project.settings.characterSpacing).toLocaleString();
}

function renderScene() {
  const frame = drawScene(canvas, project, playback.currentTime);
  const active = project.characters[frame.activeIndex];
  document.querySelector('#active-label').textContent = active ? `${active.name} · ${active.sizeMeters} m` : 'Loading…';
  document.querySelector('#phase-label').textContent = playback.playing ? (frame.phase === 'transition' ? 'Moving to next animal' : 'Animal in focus') : `${project.characters.filter((c) => c.image).length}/100 images loaded`;
  const duration = getTimelineDuration(project);
  const scrubber = document.querySelector('#timeline-scrubber');
  scrubber.max = Math.max(duration, 1); scrubber.value = playback.currentTime;
  document.querySelector('#current-time').textContent = formatTime(playback.currentTime); document.querySelector('#total-time').textContent = formatTime(duration);
  document.querySelector('#play-icon').textContent = playback.playing ? 'Ⅱ' : '▶'; document.querySelector('#play-label').textContent = playback.playing ? 'Pause Preview' : 'Play Preview';
}

function stopPlayback() { playback.playing = false; cancelAnimationFrame(playback.frame); playback.frame = 0; }
function playbackFrame(now) { if (!playback.playing) return; playback.currentTime = (now - playback.startAt) / 1000; const duration = getTimelineDuration(project); if (playback.currentTime >= duration) { playback.currentTime = duration; stopPlayback(); } renderScene(); if (playback.playing) playback.frame = requestAnimationFrame(playbackFrame); }
function togglePlayback() { if (!project.characters.length) return; if (playback.playing) { stopPlayback(); renderScene(); return; } if (playback.currentTime >= getTimelineDuration(project)) playback.currentTime = 0; playback.playing = true; playback.startAt = performance.now() - playback.currentTime * 1000; playback.frame = requestAnimationFrame(playbackFrame); renderScene(); }

async function loadImages() {
  for (let start = 0; start < project.characters.length; start += 8) {
    const batch = project.characters.slice(start, start + 8);
    await Promise.all(batch.map((animal) => loadAnimalImage(animal)));
    renderCharacterList(); renderEditor(); renderScene();
  }
  setNotice('All available animal images have been loaded from Wikipedia.');
}

function renderBackground() {
  const preview = document.querySelector('#background-preview');
  if (!project.background) { preview.innerHTML = '<span>16:9 scene background</span>'; preview.classList.remove('has-image'); return; }
  preview.innerHTML = `<img src="${project.background.url}" alt="Background preview"><span>${project.background.width} × ${project.background.height}</span>`; preview.classList.add('has-image');
}

async function uploadBackground(input) {
  const file = input.files?.[0]; if (!file) return;
  const url = URL.createObjectURL(file); const image = new Image(); image.src = url;
  await image.decode(); project.background = { url, width: image.naturalWidth, height: image.naturalHeight, imageElement: image }; renderBackground(); renderScene(); input.value = '';
}

async function startVideoExport() {
  if (exportState.generating) return; stopPlayback(); playback.currentTime = 0; renderScene();
  exportState.generating = true;
  const progress = document.querySelector('#export-progress'); const fill = document.querySelector('#progress-fill'); const value = document.querySelector('#progress-value'); const label = document.querySelector('#progress-label'); const button = document.querySelector('#generate-video'); const result = document.querySelector('#video-result');
  progress.hidden = false; button.disabled = true; result.hidden = true;
  try {
    const snapshot = { background: project.background, settings: { ...project.settings }, characters: project.characters.map((c) => ({ ...c, position: { ...c.position }, renderedDimensions: { ...c.renderedDimensions }, details: c.details.map((d) => ({ ...d })) })) };
    const blob = await generateVideo(snapshot, { resolution: document.querySelector('#export-resolution').value, fps: document.querySelector('#export-fps').value, format: document.querySelector('#export-format').value, onStatus: setNotice, onProgress: (amount) => { const percent = Math.round(amount * 100); fill.style.width = `${percent}%`; value.textContent = `${percent}%`; label.textContent = percent === 100 ? 'Finishing video…' : 'Rendering video'; } });
    if (exportState.url) URL.revokeObjectURL(exportState.url); exportState.url = URL.createObjectURL(blob);
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'; result.innerHTML = `<div class="video-ready"><span>✓ Video ready</span><span>${(blob.size / (1024 * 1024)).toFixed(1)} MB · ${extension.toUpperCase()}</span></div><video controls playsinline src="${exportState.url}"></video><a class="button button-secondary download-button" href="${exportState.url}" download="animal-size-comparison.${extension}">⬇ Download ${extension.toUpperCase()}</a>`; result.hidden = false;
  } catch (error) { setNotice(error.message || 'Video generation failed.', true); } finally { exportState.generating = false; progress.hidden = true; button.disabled = false; }
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'sort-toggle') { project.sortDirection = project.sortDirection === 'desc' ? 'asc' : 'desc'; applySort(); button.textContent = project.sortDirection === 'desc' ? 'Descending ↓' : 'Ascending ↑'; stopPlayback(); playback.currentTime = 0; renderCharacterList(); renderEditor(); renderScene(); }
  if (action === 'select-character') { project.selectedId = id; renderCharacterList(); renderEditor(); renderScene(); }
  if (action === 'toggle-play') togglePlayback();
  if (action === 'restart') { stopPlayback(); playback.currentTime = 0; renderScene(); }
  if (action === 'remove-background') { if (project.background?.url) URL.revokeObjectURL(project.background.url); project.background = null; renderBackground(); renderScene(); }
  if (action === 'generate-video') startVideoExport();
});

app.addEventListener('input', (event) => {
  const { setting } = event.target.dataset;
  if (!setting) return;
  project.settings[setting] = ['detailAnimation','characterHighlight','motionGraphics','clubNameColor','detailsColor','fontFamily'].includes(setting) ? event.target.value : Number(event.target.value);
  renderSettingsValues(); renderScene();
});

app.addEventListener('change', (event) => { if (event.target.id === 'background-file') uploadBackground(event.target); });
document.querySelector('#timeline-scrubber').addEventListener('input', (event) => { stopPlayback(); playback.currentTime = Number(event.target.value); renderScene(); });
window.addEventListener('beforeunload', () => { if (exportState.url) URL.revokeObjectURL(exportState.url); if (project.background?.url) URL.revokeObjectURL(project.background.url); });

applySort(); renderCharacterList(); renderEditor(); renderSettingsValues(); renderScene();
loadImages();
