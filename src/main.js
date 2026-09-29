// UI enhancement layer: loaded before the known-good application so canvas drawing can be adjusted safely.
const state = { boxScale: 1, textScale: 1, transparent: false };
const originalRoundRect = CanvasRenderingContext2D.prototype.roundRect;
const originalFillText = CanvasRenderingContext2D.prototype.fillText;
const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
const originalFill = CanvasRenderingContext2D.prototype.fill;
let lastRoundedRect = null;

CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
  if ((Math.abs(w - 460) < 2 || Math.abs(w - 360) < 2) && state.boxScale !== 1) {
    const nw = w * state.boxScale;
    const nh = h * state.boxScale;
    const nx = x + (w - nw) / 2;
    const ny = y + (h - nh) / 2;
    lastRoundedRect = { x: nx, y: ny, w: nw, h: nh };
    return originalRoundRect.call(this, nx, ny, nw, nh, radii);
  }
  lastRoundedRect = { x, y, w, h };
  return originalRoundRect.call(this, x, y, w, h, radii);
};

function scaleFont(font) {
  if (state.textScale === 1 || typeof font !== 'string') return font;
  return font.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${Number(n) * state.textScale}px`);
}
CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
  const oldFont = this.font;
  if (state.textScale !== 1) this.font = scaleFont(oldFont);
  const result = maxWidth === undefined ? originalFillText.call(this, text, x, y) : originalFillText.call(this, text, x, y, maxWidth * state.textScale);
  this.font = oldFont;
  return result;
};
CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxWidth) {
  const oldFont = this.font;
  if (state.textScale !== 1) this.font = scaleFont(oldFont);
  const result = maxWidth === undefined ? originalStrokeText.call(this, text, x, y) : originalStrokeText.call(this, text, x, y, maxWidth * state.textScale);
  this.font = oldFont;
  return result;
};

CanvasRenderingContext2D.prototype.fill = function(...args) {
  if (state.transparent && lastRoundedRect && (Math.abs(lastRoundedRect.w - 460 * state.boxScale) < 3 || Math.abs(lastRoundedRect.w - 360 * state.boxScale) < 3)) {
    lastRoundedRect = null;
    return;
  }
  return originalFill.apply(this, args);
};

function requestRedraw() {
  const scrubber = document.querySelector('#timeline-scrubber');
  if (scrubber) scrubber.dispatchEvent(new Event('input', { bubbles: true }));
}

function addEnhancementControls() {
  if (document.querySelector('#box-text-controls')) return;
  const panel = document.querySelector('.settings-grid');
  if (!panel) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'box-text-controls';
  wrapper.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:14px;margin-top:8px;padding-top:16px;border-top:1px solid rgba(120,140,180,.22)';
  wrapper.innerHTML = `
    <label class="range-field"><span>Box size <output id="box-size-value">100%</output></span><input id="box-size-control" type="range" min="80" max="150" step="5" value="100"></label>
    <label class="range-field"><span>Box text size <output id="box-text-size-value">100%</output></span><input id="box-text-size-control" type="range" min="80" max="160" step="5" value="100"></label>
    <label class="select-field"><span>Box fill</span><select id="box-fill-control"><option value="solid">Solid / translucent</option><option value="transparent">Border only — transparent inside</option></select></label>`;
  panel.appendChild(wrapper);
  document.querySelector('#box-size-control').addEventListener('input', e => { state.boxScale = Number(e.target.value) / 100; document.querySelector('#box-size-value').textContent = `${e.target.value}%`; requestRedraw(); });
  document.querySelector('#box-text-size-control').addEventListener('input', e => { state.textScale = Number(e.target.value) / 100; document.querySelector('#box-text-size-value').textContent = `${e.target.value}%`; requestRedraw(); });
  document.querySelector('#box-fill-control').addEventListener('change', e => { state.transparent = e.target.value === 'transparent'; requestRedraw(); });
}

await import('https://cdn.jsdelivr.net/gh/aneeshsinha82-design/FOOTBALL-CHARACTER-COMPARISON-@3f60ee26d13f1863cb97b10ac9d508934d0ee9d5/src/main.js');
addEnhancementControls();
