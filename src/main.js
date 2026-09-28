import { createCharacter, createClubCharacter, createImageAsset, releaseAsset } from './modules/characters.js';
import { drawScene, getTimelineDuration, MOTION_GRAPHIC_PRESETS } from './modules/scene.js?v=18';
import { generateVideo } from './modules/video-export.js?v=3';

/* ============================================================
   SIZING CONTROLS & MP4 EXPORT ENGINE (APPENDED)
   ============================================================ */
(function() {
  function initTools() {
    const widthInput = document.getElementById('detail-box-width');
    const paddingInput = document.getElementById('detail-box-padding');
    const scaleInput = document.getElementById('detail-text-scale');

    const valWidth = document.getElementById('val-box-width');
    const valPadding = document.getElementById('val-box-padding');
    const valScale = document.getElementById('val-text-scale');

    function applyStyles() {
      if (!widthInput || !paddingInput || !scaleInput) return;
      const w = widthInput.value + 'px';
      const p = paddingInput.value + 'rem';
      const s = scaleInput.value;

      if (valWidth) valWidth.textContent = w;
      if (valPadding) valPadding.textContent = p;
      if (valScale) valScale.textContent = parseFloat(s).toFixed(2) + 'x';

      document.querySelectorAll('.detail-box, .player-card, [class*="card"], [class*="detail"]').forEach(box => {
        box.style.setProperty('--detail-box-width', w);
        box.style.setProperty('--detail-box-padding', p);
        box.style.setProperty('--detail-text-scale', s);
      });
    }

    [widthInput, paddingInput, scaleInput].forEach(inp => {
      if (inp) inp.addEventListener('input', applyStyles);
    });

    const presets = {
      compact:  { w: 280, p: 0.75, s: 0.85 },
      medium:   { w: 380, p: 1.25, s: 1.00 },
      expanded: { w: 480, p: 1.75, s: 1.25 },
      hero:     { w: 560, p: 2.25, s: 1.50 }
    };

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        if (presets[key]) {
          widthInput.value = presets[key].w;
          paddingInput.value = presets[key].p;
          scaleInput.value = presets[key].s;
          applyStyles();
        }
      });
    });

    // MP4 Export Button Handler
    const exportBtn = document.getElementById('btn-export-video');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.textContent = "Recording MP4...";

          let mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

          const target = document.querySelector('main') || document.body;
          const canvas = await html2canvas(target, { scale: 1.5, useCORS: true });
          const stream = canvas.captureStream(30);
          const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
          const chunks = [];

          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `football-comparison-${Date.now()}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            exportBtn.textContent = "🎥 Export MP4 Video";
            exportBtn.disabled = false;
          };

          recorder.start();
          setTimeout(() => recorder.stop(), 4000);
        } catch (err) {
          alert("Video export failed: " + err.message);
          exportBtn.textContent = "🎥 Export MP4 Video";
          exportBtn.disabled = false;
        }
      });
    }

    applyStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTools);
  } else {
    initTools();
  }
})();
