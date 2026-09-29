// UI enhancement layer: loaded before the known-good application so canvas drawing can be adjusted safely.
const state = { boxScale: 1, textScale: 1, transparent: false, numberColor: '#ffd84d', labelColor: null };
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

function drawNumberAndLabel(ctx, text, x, y, maxWidth) {
  const match = String(text).match(/^(\s*[+-]?\d+(?:[.,]\d+)?)(\s+.+)$/);
  if (!match) return false;
  const numberPart = match[1];
  const labelPart = match[2];
  const numberWidth = ctx.measureText(numberPart).width;
  const labelWidth = ctx.measureText(labelPart).width;
  const totalWidth = numberWidth + labelWidth;
  let startX = x;
  if (ctx.textAlign === 'center') startX = x - totalWidth / 2;
  else if (ctx.textAlign === 'right' || ctx.textAlign === 'end') startX = x - totalWidth;
  if (maxWidth !== undefined && totalWidth > maxWidth * state.textScale) return false;
  const oldFill = ctx.fillStyle;
  ctx.fillStyle = state.numberColor;
  originalFillText.call(ctx, numberPart, startX, y);
  ctx.fillStyle = state.labelColor || oldFill;
  originalFillText.call(ctx, labelPart, startX + numberWidth, y);
  ctx.fillStyle = oldFill;
  return true;
}

CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
  const oldFont = this.font;
  const oldFill = this.fillStyle;
  if (state.textScale !== 1) this.font = scaleFont(oldFont);
  const split = drawNumberAndLabel(this, text, x, y, maxWidth);
  let result;
  if (split) result = undefined;
  else result = maxWidth === undefined ? originalFillText.call(this, text, x, y) : originalFillText.call(this, text, x, y, maxWidth * state.textScale);
  this.fillStyle = oldFill;
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
    <label class="range-field"><span>Box size <output id="box-size-value">100%</output></span><input id="box-size-control" type="range" min="60" max="300" step="5" value="100"></label>
    <label class="range-field"><span>Box text size <output id="box-text-size-value">100%</output></span><input id="box-text-size-control" type="range" min="60" max="300" step="5" value="100"></label>
    <label class="select-field"><span>Box fill</span><select id="box-fill-control"><option value="solid">Solid / translucent</option><option value="transparent">Border only — transparent inside</option></select></label>
    <label class="select-field"><span>Number color</span><select id="number-color-control"><option value="#ffd84d">Gold</option><option value="#ffffff">White</option><option value="#ff4d67">Red</option><option value="#45d9ff">Cyan</option><option value="#55e88a">Green</option><option value="#b779ff">Purple</option><option value="#ff8a3d">Orange</option><option value="#ff66d9">Pink</option></select></label>
    <label class="select-field"><span>Label color</span><select id="label-color-control"><option value="">Keep original</option><option value="#ffffff">White</option><option value="#aebbd2">Silver</option><option value="#ffd84d">Gold</option><option value="#45d9ff">Cyan</option><option value="#55e88a">Green</option><option value="#b779ff">Purple</option></select></label>`;
  panel.appendChild(wrapper);
  document.querySelector('#box-size-control').addEventListener('input', e => { state.boxScale = Number(e.target.value) / 100; document.querySelector('#box-size-value').textContent = `${e.target.value}%`; requestRedraw(); });
  document.querySelector('#box-text-size-control').addEventListener('input', e => { state.textScale = Number(e.target.value) / 100; document.querySelector('#box-text-size-value').textContent = `${e.target.value}%`; requestRedraw(); });
  document.querySelector('#box-fill-control').addEventListener('change', e => { state.transparent = e.target.value === 'transparent'; requestRedraw(); });
  document.querySelector('#number-color-control').addEventListener('change', e => { state.numberColor = e.target.value; requestRedraw(); });
  document.querySelector('#label-color-control').addEventListener('change', e => { state.labelColor = e.target.value || null; requestRedraw(); });
}

await import('https://cdn.jsdelivr.net/gh/aneeshsinha82-design/FOOTBALL-CHARACTER-COMPARISON-@3f60ee26d13f1863cb97b10ac9d508934d0ee9d5/src/main.js');
addEnhancementControls();
