import { drawScene, getTimelineDuration, SCENE_HEIGHT, SCENE_WIDTH } from './scene.js';
import { ArrayBufferTarget, Muxer } from '../vendor/mp4-muxer.js';

const H264_CODECS = ['avc1.640033','avc1.64002A','avc1.4D002A','avc1.42002A','avc1.640028','avc1.4D0028','avc1.42E01F'];
const yieldChannel = typeof MessageChannel === 'undefined' ? null : new MessageChannel();
function yieldToBrowser(){ if(!yieldChannel)return new Promise(r=>setTimeout(r,0)); return new Promise(r=>{yieldChannel.port1.onmessage=()=>r();yieldChannel.port2.postMessage(null);}); }
function parseOptions(project,resolution,fps){
 if(!project?.characters?.length)throw new Error('Add at least one character before generating a video.');
 const duration=Math.max(.1,Number(getTimelineDuration(project))||.1); const [rw,rh]=String(resolution).split('x').map(Number); const frameRate=Number(fps);
 if(!Number.isFinite(rw)||!Number.isFinite(rh)||rw<16||rh<16)throw new Error('Choose a valid export resolution.');
 if(!Number.isFinite(frameRate)||frameRate<1||frameRate>120)throw new Error('Choose a valid FPS between 1 and 120.');
 return {duration,width:Math.round(rw/2)*2,height:Math.round(rh/2)*2,frameRate};
}
function makeCanvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
async function pickH264Config(width,height,frameRate,bitrate){
 for(const codec of H264_CODECS){const config={codec,width,height,framerate:frameRate,bitrate,avc:{format:'avc'},latencyMode:'quality'};try{const {supported,resolvedConfig}=await VideoEncoder.isConfigSupported(config);if(supported)return {...config,...(resolvedConfig||{}),avc:{format:'avc'}};}catch{}}
 return null;
}
async function exportMp4WebCodecs(project,{duration,width,height,frameRate},{onProgress,onStatus}){
 const bitrate=Math.round(Math.min(40000000,Math.max(4000000,width*height*frameRate*.15))); const config=await pickH264Config(width,height,frameRate,bitrate); if(!config)return null;
 const canvas=makeCanvas(width,height); const target=new ArrayBufferTarget(); const muxer=new Muxer({target,video:{codec:'avc',width,height,frameRate},fastStart:'in-memory',firstTimestampBehavior:'offset'});
 let encoderError=null; const encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{encoderError=e;}}); encoder.configure(config);
 const totalFrames=Math.max(1,Math.round(duration*frameRate)), frameDurationUs=1000000/frameRate, keyFrameEvery=Math.max(1,Math.round(frameRate*2)); onStatus?.(`Rendering ${width} × ${height} MP4 at ${frameRate} FPS — keep this tab open…`); onProgress?.(0);
 try{
  for(let index=0;index<totalFrames;index++){
   if(encoderError)throw encoderError; while(encoder.encodeQueueSize>6){await yieldToBrowser();if(encoderError)throw encoderError;}
   drawScene(canvas,project,Math.min(duration,index/frameRate)); const frame=new VideoFrame(canvas,{timestamp:Math.round(index*frameDurationUs),duration:Math.round(frameDurationUs)});
   try{encoder.encode(frame,{keyFrame:index%keyFrameEvery===0});}finally{frame.close();}
   if(index%4===0){onProgress?.(((index+1)/totalFrames)*.97);await yieldToBrowser();}
  }
  onStatus?.('Finalizing MP4…'); await encoder.flush(); if(encoderError)throw encoderError; muxer.finalize();
 }finally{if(encoder.state!=='closed')encoder.close();}
 const bytes=target.buffer;if(!bytes?.byteLength)throw new Error('The encoder produced an empty file.');onProgress?.(1);return new Blob([bytes],{type:'video/mp4'});
}
function supportedRecorderType(kind){if(typeof MediaRecorder==='undefined')return null;const candidates=kind==='mp4'?['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];return candidates.find(t=>MediaRecorder.isTypeSupported(t))||null;}
function recordRealtime(project,{duration,width,height,frameRate},kind,mimeType,{onProgress,onStatus}){return new Promise((resolve,reject)=>{const canvas=makeCanvas(width,height);let recorder,stream,animationFrame=0,finished=false;const chunks=[];const cleanup=()=>{cancelAnimationFrame(animationFrame);stream?.getTracks().forEach(t=>t.stop());};const fail=e=>{if(finished)return;finished=true;cleanup();reject(e);};try{stream=canvas.captureStream(frameRate);recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:12000000});}catch(e){fail(e);return;}recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onerror=()=>fail(new Error('Browser recording failed. Try 1280 × 720 at 30 FPS.'));recorder.onstop=()=>{if(finished)return;finished=true;cleanup();if(!chunks.length)return reject(new Error('No video frames were recorded.'));onProgress?.(1);resolve(new Blob(chunks,{type:kind==='mp4'?'video/mp4':'video/webm'}));};onStatus?.(`Recording ${width} × ${height} ${kind.toUpperCase()} in real time (${Math.ceil(duration)} s) — keep this tab open…`);drawScene(canvas,project,0);recorder.start(250);const start=performance.now();onProgress?.(0);const render=now=>{if(finished)return;const elapsed=Math.min(duration,Math.max(0,(now-start)/1000));drawScene(canvas,project,elapsed);onProgress?.(elapsed/duration);if(elapsed>=duration){if(recorder.state!=='inactive')recorder.stop();return;}animationFrame=requestAnimationFrame(render);};animationFrame=requestAnimationFrame(render);});}
export async function generateVideo(project,{resolution,fps,format='mp4',onProgress,onStatus}={}){const options=parseOptions(project,resolution,fps),callbacks={onProgress,onStatus},wantsMp4=String(format).toLowerCase()!=='webm';if(!wantsMp4){const mime=supportedRecorderType('webm');if(!mime)throw new Error('This browser cannot record WebM video. Try the latest Chrome, Edge, or Firefox.');return recordRealtime(project,options,'webm',mime,callbacks);}if(typeof VideoEncoder!=='undefined'&&typeof VideoFrame!=='undefined'){try{const blob=await exportMp4WebCodecs(project,options,callbacks);if(blob)return blob;}catch(error){console.warn('WebCodecs MP4 export failed, trying fallback.',error);onStatus?.('Fast MP4 encoder failed, switching to real-time recording…');}}const mp4Type=supportedRecorderType('mp4');if(mp4Type)return recordRealtime(project,options,'mp4',mp4Type,callbacks);throw new Error('This browser cannot create MP4 files. Please use the latest desktop Chrome or Edge, or export WebM instead.');}
export { SCENE_WIDTH, SCENE_HEIGHT };
