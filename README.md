phongLightingModular — WebGL → WebGPU (WGSL) migration demo

Overview

This repository is a minimal, modularized port of a Phong-lit terrain demo from WebGL/GLSL to WebGPU/WGSL. The goal is educational: walk through the concrete differences you must handle when migrating shaders, buffers, and the render loop from WebGL to WebGPU.

What's in this folder

- `index.html` — entry page; includes the canvas and scripts.
- `main.js` — WebGPU-based application logic (initialization, buffer creation, uniform packing, pipeline, render loop).
- `gpuUtils.js` — WebGPU context and helper utilities (device/context configuration, depth texture helper).
- `bufferUtils.js` — helpers for WebGL buffers plus WebGPU buffer convenience wrappers and an interleaver for position+normal data.
- `geometryUtils.js` — simple terrain generator and normal computation.
- `MVnew.js` — math helpers (matrices/vectors), including `flatten()`/`normalMatrix()`.
- `shaders.js` — WGSL vertex and fragment shaders implementing Phong lighting.
- `style.css`, supporting files, and this `README.md`.

Quick start (macOS)

Simply open the index.html file in a WebGPU enabled browser.

Or:

1. Use a WebGPU-enabled browser (Chrome/Chromium with WebGPU enabled or Safari Technology Preview).
2. Serve the folder over a simple local web server (recommended):

```bash
# from the repo folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```
