# Character Comparison Studio

A lightweight browser based studio for building a character comparison scene. The current version includes project background upload, an unlimited character lineup, per-character image and detail editing, an animated 16:9 scene preview, and browser-native video export.

## Run locally

Requires Node.js 18 or newer.

```sh
npm run dev
```

Create a production build with `npm run build`, then preview it with `npm run preview`.

## Character uploads and session data

Upload PNG, JPG, JPEG, or WebP images for the background, characters, and optional detail images. Image dimensions are read from the original file, previews preserve image proportions, and the app works entirely in the browser. Images and project edits remain in memory for the current page session; they are not sent to a server or saved after the page is closed.

## Scene preview

The scene uses a logical 1920 × 1080 coordinate space. Characters are arranged left to right, and a shared deterministic timeline drives preview playback and video recording. Camera speed, character hold, transition duration, zoom strength, and character spacing have adjustable defaults.

## Video export

Use **Export MP4** to render an H.264 `.mp4` with WebCodecs and the bundled local MP4 muxer in `src/vendor`, with no CDN or FFmpeg dependency. **Export WebM** is also available. Keep the tab open while rendering.

## Project structure

- `src/main.js` builds the interface enhancements and boots the local app.
- `src/app.js` contains the application interface and interaction logic.
- `src/modules/characters.js` owns the character model and image asset lifecycle.
- `src/modules/scene.js` owns world layout, camera timeline sampling, and canvas drawing.
- `src/modules/video-export.js` renders H.264 MP4 with WebCodecs and records WebM with MediaRecorder.
- `src/vendor/mp4-muxer.js` contains the local MP4 muxer used by the WebCodecs exporter.
- `src/modules/gallery.js` remains available for the original upload gallery module.
