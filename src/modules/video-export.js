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
        const response = await fetch(url);
        if (!response.ok) throw new Error('The MP4 encoder could not be downloaded. Check your internet connection and try again.');
        return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
      };
      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
      });
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
  onStatus?.('Loading the MP4 encoder (about 31 MB, first export only)…');
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
        '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-preset', 'medium',
        '-crf', '18',
        '-r', String(fps),
        '-fps_mode', 'cfr',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputName,
      ]);
    } finally {
      ffmpeg.off('log', handleLog);
    }
    const encoded = await ffmpeg.readFile(outputName);
    onProgress?.(1);
    return new Blob([encoded], { type: 'video/mp4' });
  } catch (error) {
    const detail = error?.message || 'Encoding failed.';
    throw new Error(`The MP4 could not be encoded. Try 1280 × 720 at 30 FPS if the browser runs out of memory. ${detail}`);
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
      const recordingFormat = format === 'mp4' ? 'webm' : format;
      const mimeType = supportedMimeType(recordingFormat);
      const duration = getTimelineDuration(project);
      const [width, height] = resolution.split('x').map(Number);
      const numericFps = Number(fps);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const stream = canvas.captureStream(numericFps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      let animationFrame = 0;
      let start = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('The browser stopped recording before the video was complete.'));
      recorder.onstop = async () => {
        cancelAnimationFrame(animationFrame);
        stream.getTracks().forEach((track) => track.stop());
        if (!chunks.length) return reject(new Error('The video export finished without recording any frames.'));
        const sourceBlob = new Blob(chunks, { type: mimeType });
        try {
          resolve(format === 'mp4'
            ? await transcodeToMp4(sourceBlob, duration, width, height, numericFps, onProgress, onStatus)
            : sourceBlob);
        } catch (error) {
          reject(error);
        }
      };

      drawScene(canvas, project, 0);
      recorder.start(200);
      start = performance.now();

      const render = (now) => {
        const elapsed = Math.min(duration, (now - start) / 1000);
        drawScene(canvas, project, elapsed);
        onProgress(duration ? (elapsed / duration) * (format === 'mp4' ? 0.8 : 1) : 1);
        if (elapsed >= duration) {
          recorder.stop();
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
  if (typeof MediaRecorder === 'undefined') throw new Error('Video recording is not available in this browser. Try the latest version of Chrome.');
  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const type = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) {
    if (format === 'mp4') throw new Error('MP4 recording is not supported by this browser. Choose WebM or try the latest version of Chrome.');
    throw new Error('This browser does not support WebM video recording.');
  }
  return type;
}

export { SCENE_WIDTH, SCENE_HEIGHT };
