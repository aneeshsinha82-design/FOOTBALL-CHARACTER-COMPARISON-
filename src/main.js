// UI enhancements and local app bootstrap.
const state = { boxScale: 1, textScale: 1, transparent: false, numberColor: '#000000', labelColor: '#000000', nameColor: '#000000' };
const originalRoundRect = CanvasRenderingContext2D.prototype.roundRect;
const originalFillText = CanvasRenderingContext2D.prototype.fillText;
const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
const originalFill = CanvasRenderingContext2D.prototype.fill;
let lastRoundedRect = null;
CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
  if ((Math.abs(w-460)<2 || Math.abs(w-360)<2) && state.boxScale!==1) { const nw=w*state.boxScale, nh=h*state.boxScale, nx=x+(w-nw)/2, ny=y+(h-nh)/2; lastRoundedRect={x:nx,y:ny,w:nw,h:nh}; return originalRoundRect.call(this,nx,ny,nw,nh,r); }
  lastRoundedRect={x,y,w,h}; return originalRoundRect.call(this,x,y,w,h,r);
};
function scaleFont(font){ return state.textScale===1||typeof font!=='string'?font:font.replace(/(\d+(?:\.\d+)?)px/g,(_,n)=>`${Number(n)*state.textScale}px`); }
function isNumber(t){ return /^[-+]?\d+(?:[.,]\d+)?%?$/.test(String(t).trim()); }
function isLabel(t){ return /^(?:goals?(?: scored| per game)?|assists?(?: made)?|matches?(?: played)?|wins?|losses?|draws?|rating|points?|appearances?|minutes?|shots?|passes?|tackles?|saves?|clean sheets?|yellow cards?|red cards?)$/i.test(String(t).trim()); }
function isName(t){ const v=String(t).trim(); return !!v && !isNumber(v) && !isLabel(v) && v.length<=40 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(v); }
CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){ const f=this.font,c=this.fillStyle; if(state.textScale!==1)this.font=scaleFont(f); if(isNumber(text))this.fillStyle=state.numberColor; else if(isLabel(text))this.fillStyle=state.labelColor; else if(isName(text))this.fillStyle=state.nameColor; const r=maxWidth===undefined?originalFillText.call(this,text,x,y):originalFillText.call(this,text,x,y,maxWidth*state.textScale); this.font=f;this.fillStyle=c;return r; };
CanvasRenderingContext2D.prototype.strokeText=function(text,x,y,maxWidth){ const f=this.font,c=this.strokeStyle; if(state.textScale!==1)this.font=scaleFont(f); if(isNumber(text))this.strokeStyle=state.numberColor; else if(isLabel(text))this.strokeStyle=state.labelColor; else if(isName(text))this.strokeStyle=state.nameColor; const r=maxWidth===undefined?originalStrokeText.call(this,text,x,y):originalStrokeText.call(this,text,x,y,maxWidth*state.textScale); this.font=f;this.strokeStyle=c;return r; };
CanvasRenderingContext2D.prototype.fill=function(...args){ if(state.transparent&&lastRoundedRect&&(Math.abs(lastRoundedRect.w-460*state.boxScale)<3||Math.abs(lastRoundedRect.w-360*state.boxScale)<3)){lastRoundedRect=null;return;} return originalFill.apply(this,args); };
function redraw(){ document.querySelector('#timeline-scrubber')?.dispatchEvent(new Event('input',{bubbles:true})); }
const colors='<option value="#000000">Black</option><option value="#ffffff">White</option><option value="#ffd700">Gold</option><option value="#ff3b30">Red</option><option value="#007aff">Blue</option><option value="#00c853">Green</option><option value="#af52de">Purple</option><option value="#ff9500">Orange</option><option value="#00bcd4">Cyan</option><option value="#ff2d55">Pink</option>';
function addControls(){
  if(document.querySelector('#box-text-controls'))return; const panel=document.querySelector('.settings-grid'); if(!panel)return;
  const w=document.createElement('div');w.id='box-text-controls';w.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:14px;margin-top:8px;padding-top:16px;border-top:1px solid rgba(120,140,180,.22)';
  w.innerHTML=`<label class="range-field"><span>Box size <output id="box-size-value">100%</output></span><input id="box-size-control" type="range" min="40" max="500" step="5" value="100"></label><label class="range-field"><span>Box text size <output id="box-text-size-value">100%</output></span><input id="box-text-size-control" type="range" min="40" max="500" step="5" value="100"></label><label class="select-field"><span>Box fill</span><select id="box-fill-control"><option value="solid">Solid / translucent</option><option value="transparent">Border only — transparent inside</option></select></label><label class="select-field"><span>Character name color</span><select id="name-color-control">${colors}</select></label><label class="select-field"><span>Goals / Assists / Goal rate color</span><select id="label-color-control">${colors}</select></label><label class="select-field"><span>Figures / numbers color</span><select id="number-color-control">${colors}</select></label>`;
  panel.appendChild(w);
  document.querySelector('#box-size-control').oninput=e=>{state.boxScale=+e.target.value/100;document.querySelector('#box-size-value').textContent=e.target.value+'%';redraw();};
  document.querySelector('#box-text-size-control').oninput=e=>{state.textScale=+e.target.value/100;document.querySelector('#box-text-size-value').textContent=e.target.value+'%';redraw();};
  document.querySelector('#box-fill-control').onchange=e=>{state.transparent=e.target.value==='transparent';redraw();};
  document.querySelector('#number-color-control').onchange=e=>{state.numberColor=e.target.value;redraw();};
  document.querySelector('#label-color-control').onchange=e=>{state.labelColor=e.target.value;redraw();};
  document.querySelector('#name-color-control').onchange=e=>{state.nameColor=e.target.value;redraw();};
}
function setupExportUI(){
  const format=document.querySelector('#export-format'); const button=document.querySelector('#generate-video'); const panel=button?.parentElement; if(!format||!button||!panel)return;
  const copy=panel.querySelector('.export-copy p:last-child'); if(copy)copy.textContent='Export as an H.264 MP4 that plays everywhere. Uses the resolution and frame rate chosen above and downloads automatically when finished.';
  format.closest('label')?.setAttribute('hidden','');
  const actions=document.createElement('div');actions.className='export-actions';actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end';actions.innerHTML='<button id="generate-video-mp4" class="button button-primary generate-button" data-action="generate-video" data-format="mp4">Export MP4 <span>⬇</span></button><button id="generate-webm" class="button button-secondary generate-button" data-action="generate-video" data-format="webm">Export WebM</button>';
  button.replaceWith(actions);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action="generate-video"]');if(!b)return;format.value=b.dataset.format||'mp4';},{capture:true});
  const result=document.querySelector('#video-result'); if(result){const obs=new MutationObserver(()=>{if(!result.hidden){const a=result.querySelector('a[download]');if(a&&!a.dataset.autoClicked){a.dataset.autoClicked='1';setTimeout(()=>a.click(),50);}}});obs.observe(result,{attributes:true,childList:true,subtree:true});}
}
await import('./app.js');
addControls();
setupExportUI();
