// UI enhancement layer: loaded before the known-good application so canvas drawing can be adjusted safely.
const state = {
  boxScale: 1,
  textScale: 1,
  transparent: false,
  numberColor: '#000000',
  labelColor: '#000000',
};
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

function isStatNumber(text) {
  return /^[-+]?\d+(?:[.,]\d+)?%?$/.test(String(text).trim());
}

function isStatLabel(text) {
  const value = String(text).trim();
  return /^(?:goals?(?: scored| per game)?|assists?(?: made)?|matches?(?: played)?|wins?|losses?|draws?|rating|points?|appearances?|minutes?|shots?|passes?|tackles?|saves?|clean sheets?|yellow cards?|red cards?)$/i.test(value);
}

CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
  const oldFont = this.font;
  const oldFillStyle = this.fillStyle;
  if (state.textScale !== 1) this.font = scaleFont(oldFont);
  if (isStatNumber(text)) this.fillStyle = state.numberColor;
  else if (isStatLabel(text)) this.fillStyle = state.labelColor;
  const result = maxWidth === undefined
    ? originalFillText.call(this, text, x, y)
    : originalFillText.call(this, text, x, y, maxWidth * state.textScale);
  this.font = oldFont;
  this.fillStyle = oldFillStyle;
  return result;
};

CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxWidth) {
  const oldFont = this.font;
  const oldStrokeStyle = this.strokeStyle;
  if (state.textScale !== 1) this.font = scaleFont(oldFont);
  if (isStatNumber(text)) this.strokeStyle = state.numberColor;
  else if (isStatLabel(text)) this.strokeStyle = state.labelColor;
  const result = maxWidth === undefined
    ? originalStrokeText.call(this, text, x, y)
    : originalStrokeText.call(this, text, x, y, maxWidth * state.textScale);
  this.font = oldFont;
  this.strokeStyle = oldStrokeStyle;
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
    <label class="select-field"><span>Number color</span><select id="number-color-control"><option value="#000000">Black</option><option value="#ffffff">White</option><option value="#ffd700">Gold</option><option value="#ff3b30">Red</option><option value="#007aff">Blue</option><option value="#00c853">Green</option><option value="#af52de">Purple</option><option value="#ff9500">Orange</option><option value="#00bcd4">Cyan</option><option value="#ff2d55">Pink</option></select></label>
    <label class="select-field"><span>Label color</span><select id="label-color-control"><option value="#000000">Black</option><option value="#ffffff">White</option><option value="#ffd700">Gold</option><option value="#ff3b30">Red</option><option value="#007aff">Blue</option><option value="#00c853">Green</option><option value="#af52de">Purple</option><option value="#ff9500">Orange</option><option value="#00bcd4">Cyan</option><option value="#ff2d55">Pink</option></select></label>`;
  panel.appendChild(wrapper);

  document.querySelector('#box-size-control').addEventListener('input', e => {
    state.boxScale = Number(e.target.value) / 100;
    document.querySelector('#box-size-value').textContent = `${e.target.value}%`;
    requestRedraw();
  });
  document.querySelector('#box-text-size-control').addEventListener('input', e => {
    state.textScale = Number(e.target.value) / 100;
    document.querySelector('#box-text-size-value').textContent = `${e.target.value}%`;
    requestRedraw();
  });
  document.querySelector('#box-fill-control').addEventListener('change', e => {
    state.transparent = e.target.value === 'transparent';
    requestRedraw();
  });
  document.querySelector('#number-color-control').addEventListener('change', e => {
    state.numberColor = e.target.value;
    requestRedraw();
  });
  document.querySelector('#label-color-control').addEventListener('change', e => {
    state.labelColor = e.target.value;
    requestRedraw();
  });
}

await import('https://cdn.jsdelivr.net/gh/aneeshsinha82-design/FOOTBALL-CHARACTER-COMPARISON-@3f60ee26d13f1863cb97b10ac9d508934d0ee9d5/src/main.js');
addEnhancementControls();
