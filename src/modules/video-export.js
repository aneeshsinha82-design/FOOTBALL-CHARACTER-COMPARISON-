import { drawScene, getTimelineDuration, SCENE_HEIGHT, SCENE_WIDTH } from './scene.js';

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

async function blobUrl(url, type) {
  const response = await fetch(url, { cache: 'no-store', mode: 'cors' });
  if (!response.ok) throw new Error(`Could not download encoder component (${response.status}).`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
}

async function loadFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
    const ffmpeg = new FFmpeg();
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

    // Use blob URLs so the FFmpeg worker can load the WASM/core files without
    // cross-origin worker restrictions. Keep the URLs alive for the lifetime
    // of the encoder rather than revoking them immediately after load().
    const coreURL = await blobUrl(`${base}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await blobUrl(`${base}/ffmpeg-core.wasm`, 'application/wasm');
    const workerURL = await blobUrl(`${base}/ffmpeg-core.worker.js`, 'text/javascript');

    try {
      await ffmpeg.load({ coreURL, wasmURL, workerURL });
    } catch (error) {
      URL.revokeObjectURL(coreURL);
      URL.revokeObjectURL(wasmURL);
      URL.revokeObjectURL(workerURL);
      throw error;
    }

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })().catch((error) => {
    ffmpegLoadPromise = null;
    throw new Error(`MP4 encoder could not start. ${error?.message || error}`);
  });

  return ffmpegLoadPromise;
}

async function transcodeToMp4(sourceBlob, duration, width, height, fps, onProgress, onStatus) {
  onStatus?.('Starting MP4 encoder…');
  const ffmpeg = await loadFfmpeg();
  const inputName = 'comparison-source.webm';
  const outputName = 'football-club-comparison.mp4';
  const inputBytes = new Uint8Array(await sourceBlob.arrayBuffer());

  try {
    await ffmpeg.writeFile(inputName, inputBytes);
    onStatus?.(`Encoding ${width} × ${height} MP4 at ${fps} FPS…`);

    await ffmpeg.exec([
      '-i', inputName,
      '-map', '0:v:0',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-r', String(fps),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-f', 'mp4',
      outputName,
    ]);

    const encoded = await ffmpeg.readFile(outputName);
    const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
    if (!bytes.length) throw new Error('FFmpeg returned an empty file.');

    // ISO-BMFF/MP4 files contain the ASCII "ftyp" box near byte 4.
    const header = new TextDecoder().decode(bytes.slice(4, 12));
    if (!header.includes('ftyp')) throw new Error('The encoder returned a non-MP4 file.');

    onProgress?.(1);
    return new Blob([bytes], { type: 'video/mp4' });
  } catch (error) {
    const detail = error?.message || 'Unknown encoding error.';
    throw new Error(`MP4 export failed: ${detail} Try 1280 × 720 at 30 FPS if the browser is low on memory.`);
  } finally {
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ]);
  }
}

export function generateVideo(project, { resolution, fps, format = 'mp4', onProgress, onStatus }) {
  return new Promise((resolve, reject) => {
    let recorder;
    let stream;
    let animationFrame = 0;
    let finished = false;

    try {
      if (!project?.characters?.length) {
        throw new Error('Add at least one character before generating a video.');
      }

      const normalizedFormat = String(format).toLowerCase() === 'webm' ? 'webm' : 'mp4';
      const mimeType = supportedMimeType('webm');
      const duration = Math.max(0.1, Number(getTimelineDuration(project)) || 0.1);
      const [width, height] = String(resolution).split('x').map(Number);
      const numericFps = Number(fps);

      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
        throw new Error('Choose a valid export resolution.');
      }
      if (!Number.isFinite(numericFps) || numericFps < 1 || numericFps > 120) {
        throw new Error('Choose a valid FPS between 1 and 120.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      stream = canvas.captureStream(numericFps);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
      const chunks = [];
      let start = 0;

      const cleanup = () => {
        cancelAnimationFrame(animationFrame);
        stream?.getTracks().forEach((track) => track.stop());
      };

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };

      recorder.onerror = () => {
        if (!finished) {
          finished = true;
          cleanup();
          reject(new Error('Browser recording failed. Use the latest Chrome and try 1280 × 720 at 30 FPS.'));
        }
      };

      recorder.onstop = async () => {
        if (finished) return;
        finished = true;
        cleanup();
        if (!chunks.length) {
          reject(new Error('No video frames were recorded.'));
          return;
        }

        const sourceBlob = new Blob(chunks, { type: mimeType });
        try {
          if (normalizedFormat === 'webm') {
            onProgress?.(1);
            resolve(new Blob([sourceBlob], { type: 'video/webm' }));
          } else {
            resolve(await transcodeToMp4(sourceBlob, duration, width, height, numericFps, onProgress, onStatus));
          }
        } catch (error) {
          reject(error);
        }
      };

      // Draw the first frame before starting MediaRecorder so frame 0 is never blank.
      drawScene(canvas, project, 0);
      recorder.start(250);
      start = performance.now();
      onProgress?.(0);

      const render = (now) => {
        if (finished) return;
        const elapsed = Math.min(duration, Math.max(0, (now - start) / 1000));
        drawScene(canvas, project, elapsed);
        onProgress?.((elapsed / duration) * (normalizedFormat === 'mp4' ? 0.8 : 1));

        if (elapsed >= duration) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        animationFrame = requestAnimationFrame(render);
      };

      animationFrame = requestAnimationFrame(render);
    } catch (error) {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      reject(error);
    }
  });
}

function supportedMimeType(format) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording is not available in this browser. Try the latest Chrome.');
  }
  const candidates = format === 'webm'
    ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  const type = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) throw new Error(`This browser does not support ${format.toUpperCase()} recording.`);
  return type;
}

export { SCENE_WIDTH, SCENE_HEIGHT };
