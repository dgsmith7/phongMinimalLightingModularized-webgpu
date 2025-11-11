"use strict";

// WebGPU-based main.js
// This file mirrors the original WebGL main.js logic but uses WebGPU and WGSL.
// It depends on the global helpers added in `gpuUtils.js` and `bufferUtils.js`.

let gpu = null;
let device = null;
let queue = null;
let format = null;
let context = null;

// scene / camera / lighting state (kept minimal for Phong demo)
let near = 0.1;
let far = 100.0;

let lightAmbient = vec4(0.3, 0.3, 0.3, 1.0);
let lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
let lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

let materialAmbient = vec4(0.1, 0.1, 0.3, 1.0);
let materialDiffuse = vec4(0.2, 0.2, 0.6, 1.0);
let materialSpecular = vec4(0.8, 0.8, 0.8, 1.0);
let materialShininess = 50.0;

// gui-controlled values
let camX = 13;
let camY = 7;
let camZ = -11;

let lightX = 2;
let lightY = 4;
let lightZ = 2;

// model / view / projection
let modelViewMatrix, projectionMatrix;
let eye;
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);

// GPU resources
let vertexBufferGPU = null;
let uniformBuffer = null;
let pipeline = null;
let bindGroup = null;
let vertexCount = 0;

// Constants for uniform layout
const FLOATS_PER_MAT4 = 16;

async function init() {
  // initialize WebGPU
  gpu = await initializeWebGPU("gl-canvas");
  if (!gpu) {
    console.error("WebGPU initialization failed");
    return;
  }
  device = gpu.device;
  queue = gpu.queue;
  context = gpu.context;
  format = gpu.format;

  // Production note: WebGPU differs from WebGL in several ways.
  // - WebGL is a stateful API with global state (bound program, bound
  //   buffers, enabled attributes). WebGPU is explicit: you obtain a
  //   `GPUDevice` and create pipelines, bind groups, and command encoders.
  // - There is no `gl.uniform*` in WebGPU; instead you write into GPU
  //   buffers (uniform/storage) and bind them via bind groups. This makes
  //   resource layout explicit and usually more verbose but more predictable.
  // - We do not expose `device`/`gpu` on `window` in production to avoid
  //   leaking internals; use local logging or temporary debugging helpers
  //   during development instead.

  // generate terrain mesh and normals
  const vertices = generateMesh(); // geometryUtils.js
  const { p: positionsArray, n: normalsArray } = computeNormals(vertices); // geometryUtils.js

  // interleave vertex data [x,y,z, nx,ny,nz]
  const interleaved = interleaveVertexData(positionsArray, normalsArray);
  vertexCount = interleaved.length / 6;

  // Attribute/layout note:
  // - In WebGL you'd call `gl.vertexAttribPointer(location, size, type, ... )`.
  // - In WebGPU we declare `arrayStride` in bytes and `attributes` with
  //   `shaderLocation` and format like 'float32x3'. These locations must
  //   exactly match the `@location` annotations in the WGSL vertex shader.

  // create GPU vertex buffer
  vertexBufferGPU = createGPUVertexBuffer(
    device,
    interleaved,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );

  // create uniform buffer (we'll pack modelView, projection, normalMatrix, light + material products, shininess)
  // layout (floats): modelView(16), projection(16), normalMat4(16), lightPos(4), ambient(4), diffuse(4), specular(4), shininess+pad(4) = 68 floats
  const uniformFloatCount = 68;
  const uniformBufferSize = uniformFloatCount * 4;
  uniformBuffer = createUniformBuffer(device, uniformBufferSize);

  // Uniform buffer / packing notes:
  // - WebGPU requires explicit alignment and padding. We pack matrices as
  //   arrays of vec4 (16-byte aligned) to match WGSL's expected layout.
  // - Flattening in this project produces column-major order so the JS
  //   matrix multiplication and the WGSL `mat4x4<f32>` construction align.
  // - Also note the projection correction we apply later -- WebGL uses
  //   clip-space z in [-1,1], while WebGPU uses [0,1]; we adjust the
  //   projection matrix accordingly before sending to the GPU.

  // create WGSL shader modules (production sources)
  const vertCode = window.wgslVertexSource || "";
  const fragCode = window.wgslFragmentSource || "";
  const vertModule = device.createShaderModule({ code: vertCode });
  const fragModule = device.createShaderModule({ code: fragCode });

  // Try to fetch shader compilation info (may provide useful diagnostics in console)
  try {
    if (vertModule.getCompilationInfo) {
      vertModule.getCompilationInfo().then((info) => {
        if (info.messages.length > 0) {
          console.group("Vertex shader compilationInfo");
          info.messages.forEach((m) => console.warn(m));
          console.groupEnd();
        }
      });
    } else if (vertModule.compilationInfo) {
      vertModule.compilationInfo().then((info) => {
        if (info.messages.length > 0) {
          console.group("Vertex shader compilationInfo");
          info.messages.forEach((m) => console.warn(m));
          console.groupEnd();
        }
      });
    }

    if (fragModule.getCompilationInfo) {
      fragModule.getCompilationInfo().then((info) => {
        if (info.messages.length > 0) {
          console.group("Fragment shader compilationInfo");
          info.messages.forEach((m) => console.warn(m));
          console.groupEnd();
        }
      });
    } else if (fragModule.compilationInfo) {
      fragModule.compilationInfo().then((info) => {
        if (info.messages.length > 0) {
          console.group("Fragment shader compilationInfo");
          info.messages.forEach((m) => console.warn(m));
          console.groupEnd();
        }
      });
    }
  } catch (e) {
    console.warn("Shader compilationInfo unavailable or caused an error:", e);
  }

  // pipeline and bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });
  // create pipeline (production defaults)
  pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: vertModule,
      entryPoint: "main",
      buffers: [
        {
          arrayStride: 6 * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
          ],
        },
      ],
    },
    fragment: {
      module: fragModule,
      entryPoint: "main",
      targets: [{ format: format }],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "cw",
      cullMode: "none",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // wire up GUI and start
  addEventListeners(); // eventHandlers.js

  requestAnimationFrame(frame);
}

function packUniforms() {
  // compute matrices
  eye = vec3(camX, camY, camZ);
  modelViewMatrix = lookAt(eye, at, up);
  const fovy = 60;
  const aspect =
    document.getElementById("gl-canvas").clientWidth /
    document.getElementById("gl-canvas").clientHeight;
  projectionMatrix = perspective(fovy, aspect, near, far);

  // normal matrix as mat3 -> convert to mat4 layout for alignment
  const nm3 = normalMatrix(modelViewMatrix, true); // returns 3x3
  // build a 4x4 with last row/col set so memory layout matches mat4
  let normalMat4 = mat4();
  // copy nm3 into upper-left
  // copy nm3 into upper-left
  for (let r = 0; r < 3; ++r) {
    for (let c = 0; c < 3; ++c) {
      normalMat4[r][c] = nm3[r][c];
    }
  }

  // lighting
  const lightPosition = vec4(lightX, lightY, lightZ, 0.0);
  // transform light into eye-space so lighting calculations (which use
  // positions in eye-space) are consistent when the camera moves.
  const lightPositionEye = mult(modelViewMatrix, lightPosition);

  // products
  const ambientProduct = mult(lightAmbient, materialAmbient);
  const diffuseProduct = mult(lightDiffuse, materialDiffuse);
  const specularProduct = mult(lightSpecular, materialSpecular);

  // pack into Float32Array in the same order as the WGSL struct
  // We'll pack MVP (projection * modelView) into the first 16 floats so the
  // vertex shader can read a single uniform matrix. The rest of the buffer
  // keeps other data (normal matrix, light, products) in the same relative
  // places as before so we don't need to change the whole layout yet.
  const data = new Float32Array(68);
  let offset = 0;

  // compute MVP = projection * modelView
  // Note: flatten produces column-major order compatible with mat4x4<f32>
  const mView = new Float32Array(flatten(modelViewMatrix));
  const mProj = new Float32Array(flatten(projectionMatrix));
  // multiply mProj * mView (both column-major) -> result column-major
  function mulMat4(a, b) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; ++r) {
      for (let c = 0; c < 4; ++c) {
        let sum = 0.0;
        for (let k = 0; k < 4; ++k) {
          // column-major: index = row + col*4
          sum += a[r + k * 4] * b[k + c * 4];
        }
        out[r + c * 4] = sum;
      }
    }
    return out;
  }

  // Correct projection from WebGL (-1..1) to WebGPU (0..1) depth range by
  // pre-multiplying with a correction matrix C so z' = 0.5*z + 0.5*w.
  const C = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1,
  ]);
  const mProjCorr = mulMat4(C, mProj);
  const mMVP = mulMat4(mProjCorr, mView);
  for (let i = 0; i < 16; ++i) data[offset++] = mMVP[i];

  // pack modelView (eye-space transform) so the shader can compute lighting
  // in eye-space (modelView) while using mMVP for clip-space position.
  for (let i = 0; i < 16; ++i) data[offset++] = mView[i];

  // normalMatrix as mat4 (next 16 floats)
  new Float32Array(flatten(normalMat4)).forEach((v) => {
    data[offset++] = v;
  });
  // lightPosition (4 floats) -- pack eye-space light
  new Float32Array(flatten(lightPositionEye)).forEach((v) => {
    data[offset++] = v;
  });
  // ambientProduct
  new Float32Array(flatten(ambientProduct)).forEach((v) => {
    data[offset++] = v;
  });
  // diffuseProduct
  new Float32Array(flatten(diffuseProduct)).forEach((v) => {
    data[offset++] = v;
  });
  // specularProduct
  new Float32Array(flatten(specularProduct)).forEach((v) => {
    data[offset++] = v;
  });
  // shininess + pad
  data[offset++] = materialShininess;
  data[offset++] = 0.0;
  data[offset++] = 0.0;
  data[offset++] = 0.0;

  return data;
}

function frame() {
  // update canvas size / depth texture if needed
  gpu.onResize();

  // update uniforms
  const uniformData = packUniforms();
  queue.writeBuffer(
    uniformBuffer,
    0,
    uniformData.buffer,
    uniformData.byteOffset || 0,
    uniformData.byteLength
  );

  // begin render
  const { view, depthView } = gpu.getCurrentViews();
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: view,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
    depthStencilAttachment: {
      view: depthView,
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.setVertexBuffer(0, vertexBufferGPU);
  renderPass.draw(vertexCount, 1, 0, 0);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);

  requestAnimationFrame(frame);
}

// start
init();
