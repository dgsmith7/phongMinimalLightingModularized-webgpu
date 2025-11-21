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

Notes on WebGL vs WebGPU (high level)

- API style

  - WebGL: stateful, implicit framebuffer, `gl.uniform*`, `gl.vertexAttribPointer`, `gl.drawElements`.
  - WebGPU: explicit device, pipeline, bind groups, `GPUBuffer` resources, command encoders. You create a pipeline layout and bind groups that explicitly declare the resources the shader reads.

- Shading language

  - GLSL (WebGL): uses `in`/`out`, `layout(location = X)`, `gl_Position`, `gl_FragColor`.
  - WGSL (WebGPU): uses `@location`, `@builtin(position)`, and `@vertex` / `@fragment` annotations. All varyings and uniform layouts must match exactly and alignment/padding rules are stricter.

- Uniforms and packing

  - WebGL: `gl.uniformMatrix4fv(uMVP, false, flatten(mvp))` writes directly.
  - WebGPU: you write to a GPUBuffer and the shader reads via a `var<uniform>` bound to a bind group. Uniform buffers require 16-byte alignment for `vec4`; matrices are safest when packed as `array<vec4<f32>, 4>` (column-major).

- Clip-space differences

  - WebGL (GLSL) uses clip Z in [-1, 1]. WebGPU expects Z in [0, 1]. This code applies a small correction matrix to the projection to convert from the WebGL-style projection to WebGPU's depth range.

- Attribute layout

  - WebGL: `gl.vertexAttribPointer(location, size, GL_FLOAT, normalize, stride, offset)`.
  - WebGPU: vertex buffer descriptors use `arrayStride` in bytes and `attributes` with `shaderLocation` and a `format` like `float32x3`. Ensure the locations and formats match the WGSL `@location` annotations.

- Face winding & culling
  - WebGL default front face = CCW. The mesh generator in `geometryUtils.js` uses a left-hand winding. To preserve visual parity the pipeline here defaults to double-sided rendering (no culling). If you switch to back-face culling, either flip the winding in the mesh generator or change `frontFace`.

Debugging tips

- If the canvas is blank or shader errors appear, open DevTools Console. This project logs shader compilation messages when available.
- If parts of the mesh are missing, check:
  - face winding and culling (pipeline `frontFace` / `cullMode` in `main.js`)
  - depth-testing (depth compare, depth texture creation)
  - uniform packing (are matrices packed column-major? are arrays aligned to vec4?)
- To visualize geometry without lighting, you can temporarily replace the fragment WGSL in `shaders.js` with a simple constant color (magenta) to confirm vertex pipeline/attributes are correct.

Advanced notes for students

- Comparison exercises:
  - Put a left column of code showing the original GLSL snippet and the right column as the WGSL translation to see one-to-one differences (annotations, constructors, matrix handling).
  - Try changing the mesh winding in `geometryUtils.js` to CCW and then set the pipeline to cull back faces to see performance/behavior differences.

License & credits

This learning demo is provided as-is for educational purposes. Use and adapt freely.
