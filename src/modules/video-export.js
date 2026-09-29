import { drawScene, getTimelineDuration, SCENE_HEIGHT, SCENE_WIDTH } from './scene.js';

/*
 * Video export
 * MP4  : frames are rendered one by one (not real time), encoded to H.264 with the browser's
 *        WebCodecs VideoEncoder, then packed into an MP4 with the real mp4-muxer library.
 *        Falls back to native MP4 MediaRecorder if WebCodecs is unavailable.
 * WebM : real-time MediaRecorder capture of the canvas.
 */

const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs';

const H264_CODECS = ['avc1.640033', 'avc1.64002A', 'avc1.4D002A', 'avc1.42002A', 'avc1.640028', 'avc1.4D0028', 'avc1.42E01F'];

const yieldChannel = typeof MessageChannel === 'undefined' ? null : new MessageChannel();
function yieldToBrowser() {
  if (!yieldChannel) return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => {
    yieldChannel.port1.onmessage = () => resolve();
    yieldChannel.port2.postMessage(null);
  });
}

function parseOptions(project, resolution, fps) {
  if (!project?.characters?.length) throw new Error('Add at least one character before generating a video.');
  const duration = Math.max(0.1, Number(getTimelineDuration(project)) || 0.1);
  const [rawWidth, rawHeight] = String(resolution).split('x').map(Number);
  const frameRate = Number(fps);
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth < 16 || rawHeight < 16) {
    throw new Error('Choose a valid export resolution.');
  }
  if (!Number.isFinite(frameRate) || frameRate < 1 || frameRate > 120) {
    throw new Error('Choose a valid FPS between 1 and 120.');
  }
  const width = Math.round(rawWidth / 2) * 2;
  const height = Math.round(rawHeight / 2) * 2;
  return { duration, width, height, frameRate };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function pickH264Config(width, height, frameRate, bitrate) {
  for (const codec of H264_CODECS) {
    const config = { codec, width, height, framerate: frameRate, bitrate, avc: { format: 'avc' }, latencyMode: 'quality' };
    try {
      const { supported, config: resolved } = await VideoEncoder.isConfigSupported(config);
      if (supported) return { ...config, ...resolved, avc: { format: 'avc' } };
    } catch { /* try next */ }
  }
  return null;
}

async function exportMp4WebCodecs(project, { duration, width, height, frameRate }, { onProgress, onStatus }) {
  const bitrate = Math.round(Math.min(40_000_000, Math.max(4_000_000, width * height * frameRate * 0.15)));
  const config = await pickH264Config(width, height, frameRate, bitrate);
  if (!config) return null;

  // Loaded on demand so a CDN problem can never break the rest of the app (caller falls back to recording).
  const { ArrayBufferTarget, Muxer } = await import(MUXER_URL);

  const canvas = makeCanvas(width, height);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => { encoderError = error; },
  });
  encoder.configure(config);

  const totalFrames = Math.max(1, Math.round(duration * frameRate));
  const frameDurationUs = 1_000_000 / frameRate;
  const keyFrameEvery = Math.max(1, Math.round(frameRate * 2));

  onStatus?.(`Rendering ${width} × ${height} MP4 at ${frameRate} FPS — keep this tab open…`);
  onProgress?.(0);

  try {
    for (let index = 0; index < totalFrames; index += 1) {
      if (encoderError) throw encoderError;
      while (encoder.encodeQueueSize > 6) {
        await yieldToBrowser();
        if (encoderError) throw encoderError;
      }
      drawScene(canvas, project, Math.min(duration, index / frameRate));
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(index * frameDurationUs),
        duration: Math.round(frameDurationUs),
      });
      try {
        encoder.encode(frame, { keyFrame: index % keyFrameEvery === 0 });
      } finally {
        frame.close();
      }
      if (index % 4 === 0) {
        onProgress?.(((index + 1) / totalFrames) * 0.97);
        await yieldToBrowser();
      }
    }
    onStatus?.('Finalizing MP4…');
    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }

  const bytes = target.buffer;
  if (!bytes?.byteLength) throw new Error('The encoder produced an empty file.');
  onProgress?.(1);
  return new Blob([bytes], { type: 'video/mp4' });
}

function supportedRecorderType(kind) {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = kind === 'mp4'
    ? ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function recordRealtime(project, { duration, width, height, frameRate }, kind, mimeType, { onProgress, onStatus }) {
  return new Promise((resolve, reject) => {
    const canvas = makeCanvas(width, height);
    let recorder;
    let stream;
    let animationFrame = 0;
    let finished = false;
    const chunks = [];

    const cleanup = () => {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
    };
    const fail = (error) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    };

    try {
      stream = canvas.captureStream(frameRate);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
    } catch (error) {
      fail(error);
      return;
    }

    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = () => fail(new Error('Browser recording failed. Try 1280 × 720 at 30 FPS.'));
    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!chunks.length) return reject(new Error('No video frames were recorded.'));
      onProgress?.(1);
      resolve(new Blob(chunks, { type: kind === 'mp4' ? 'video/mp4' : 'video/webm' }));
    };

    onStatus?.(`Recording ${width} × ${height} ${kind.toUpperCase()} in real time (${Math.ceil(duration)} s) — keep this tab open…`);
    drawScene(canvas, project, 0);
    recorder.start(250);
    const start = performance.now();
    onProgress?.(0);

    const render = (now) => {
      if (finished) return;
      const elapsed = Math.min(duration, Math.max(0, (now - start) / 1000));
      drawScene(canvas, project, elapsed);
      onProgress?.(elapsed / duration);
      if (elapsed >= duration) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
  });
}

export async function generateVideo(project, { resolution, fps, format = 'mp4', onProgress, onStatus } = {}) {
  const options = parseOptions(project, resolution, fps);
  const callbacks = { onProgress, onStatus };
  const wantsMp4 = String(format).toLowerCase() !== 'webm';

  if (!wantsMp4) {
    const mimeType = supportedRecorderType('webm');
    if (!mimeType) throw new Error('This browser cannot record WebM video. Try the latest Chrome, Edge, or Firefox.');
    return recordRealtime(project, options, 'webm', mimeType, callbacks);
  }

  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined') {
    try {
      const blob = await exportMp4WebCodecs(project, options, callbacks);
      if (blob) return blob;
    } catch (error) {
      console.warn('WebCodecs MP4 export failed, trying fallback.', error);
      onStatus?.('Fast MP4 encoder failed, switching to real-time recording…');
    }
  }

  const mp4Type = supportedRecorderType('mp4');
  if (mp4Type) return recordRealtime(project, options, 'mp4', mp4Type, callbacks);

  throw new Error('This browser cannot create MP4 files. Please use the latest desktop Chrome or Edge, or export WebM instead.');
}

export { SCENE_WIDTH, SCENE_HEIGHT };
