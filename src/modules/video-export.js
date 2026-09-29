import { drawScene, getTimelineDuration, SCENE_HEIGHT, SCENE_WIDTH } from './scene.js';

let ffmpegInstance;
let ffmpegLoadPromise;

async function loadFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const packageUrl = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js';
      const { FFmpeg } = await import(packageUrl);
      const ffmpeg = new FFmpeg();
      const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
      const toBlobURL = async (url, type) => {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Could not download FFmpeg component (${response.status}).`);
        return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
      };
      const coreURL = await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm');
      try {
        await ffmpeg.load({ coreURL, wasmURL });
      } finally {
        URL.revokeObjectURL(coreURL);
        URL.revokeObjectURL(wasmURL);
      }
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      ffmpegLoadPromise = null;
      throw error;
    });
  }
  return ffmpegLoadPromise;
}

async function transcodeToMp4(sourceBlob, duration, width, height, fps, onProgress, onStatus) {
  onStatus?.('Loading the MP4 encoder…');
  const ffmpeg = await loadFfmpeg();
  const inputName = 'comparison-source.webm';
  const outputName = 'football-club-comparison.mp4';
  const inputBytes = new Uint8Array(await sourceBlob.arrayBuffer());
  try {
    await ffmpeg.writeFile(inputName, inputBytes);
    const handleLog = ({ message }) => {
      const match = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        onProgress?.(0.82 + Math.min(seconds / Math.max(duration, 0.001), 1) * 0.17);
      }
    };
    ffmpeg.on('log', handleLog);
    onStatus?.(`Encoding ${width} × ${height} H.264 MP4 at ${fps} FPS…`);
    try {
      await ffmpeg.exec([
        '-i', inputName,
        '-map', '0:v:0',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-f', 'mp4',
        outputName,
      ]);
    } finally {
      ffmpeg.off('log', handleLog);
    }

    const encoded = await ffmpeg.readFile(outputName);
    if (!encoded?.length) throw new Error('FFmpeg produced an empty MP4 file.');
    const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
    const header = new TextDecoder().decode(bytes.slice(4, 12));
    if (!header.includes('ftyp')) throw new Error('The encoder did not produce a valid MP4 container.');
    onProgress?.(1);
    return new Blob([bytes.buffer], { type: 'video/mp4' });
  } catch (error) {
    const detail = error?.message || 'Encoding failed.';
    throw new Error(`The MP4 could not be created. ${detail} Try 1280 × 720 at 30 FPS if the browser runs out of memory.`);
  } finally {
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ]);
  }
}

export function generateVideo(project, { resolution, fps, format = 'mp4', onProgress, onStatus }) {
  return new Promise((resolve, reject) => {
    try {
      if (!project.characters.length) throw new Error('Add at least one character before generating a video.');
      const normalizedFormat = String(format).toLowerCase() === 'webm' ? 'webm' : 'mp4';
      const mimeType = supportedMimeType('webm');
      const duration = getTimelineDuration(project);
      const [width, height] = resolution.split('x').map(Number);
      const numericFps = Number(fps);
      if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(numericFps) || numericFps <= 0) {
        throw new Error('Choose a valid export resolution and frame rate.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const stream = canvas.captureStream(numericFps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      let animationFrame = 0;
      let start = 0;
      let stopped = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (!stopped) reject(new Error('The browser stopped recording. Try the latest Chrome.'));
      };
      recorder.onstop = async () => {
        stopped = true;
        cancelAnimationFrame(animationFrame);
        stream.getTracks().forEach((track) => track.stop());
        if (!chunks.length) return reject(new Error('No video frames were recorded.'));
        const sourceBlob = new Blob(chunks, { type: mimeType });
        try {
          if (normalizedFormat === 'mp4') {
            resolve(await transcodeToMp4(sourceBlob, duration, width, height, numericFps, onProgress, onStatus));
          } else {
            onProgress?.(1);
            resolve(new Blob([sourceBlob], { type: 'video/webm' }));
          }
        } catch (error) {
          reject(error);
        }
      };

      drawScene(canvas, project, 0);
      recorder.start(250);
      start = performance.now();
      onProgress?.(0);

      const render = (now) => {
        const elapsed = Math.min(duration, Math.max(0, (now - start) / 1000));
        drawScene(canvas, project, elapsed);
        onProgress?.(duration ? (elapsed / duration) * (normalizedFormat === 'mp4' ? 0.8 : 1) : 1);
        if (elapsed >= duration) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        animationFrame = requestAnimationFrame(render);
      };
      animationFrame = requestAnimationFrame(render);
    } catch (error) {
      reject(error);
    }
  });
}

function supportedMimeType(format) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Video recording is not available. Try the latest Chrome.');
  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const type = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) throw new Error(`This browser does not support ${format.toUpperCase()} video recording.`);
  return type;
}

export { SCENE_WIDTH, SCENE_HEIGHT };
