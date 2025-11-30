// gpuUtils.js
// Minimal WebGPU initialization helpers for the phongLightingMinimal project.
// This file intentionally mirrors the WebGL utilities but for WebGPU.
//
// Notes on WebGL vs WebGPU initialization:
// - WebGL uses `canvas.getContext('webgl')` and manages a default framebuffer
//   implicitly. WebGPU requires `canvas.getContext('webgpu')` and explicit
//   configuration of the swap chain via `context.configure(...)`.
// - WebGPU surfaces require you to choose a canvas format (we use
//   navigator.gpu.getPreferredCanvasFormat()). There is no implicit default
//   framebuffer like in WebGL; you explicitly request the current texture
//   each frame for rendering.

async function initializeWebGPU(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("initializeWebGPU: canvas not found - id=", canvasId);
    return null;
  }
  if (!navigator.gpu) {
    alert(
      "WebGPU is not supported in this browser. Try Chrome/Chromium with WebGPU enabled or Safari TP."
    );
    console.error("WebGPU not available (navigator.gpu is undefined)");
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    alert("Failed to get GPU adapter");
    console.error("Failed to request GPU adapter");
    return null;
  }
  const device = await adapter.requestDevice();
  if (!device) {
    alert("Failed to get GPU device");
    console.error("Failed to request GPU device");
    return null;
  }
  const context = canvas.getContext("webgpu");
  if (!context) {
    alert("Failed to get WebGPU canvas context");
    console.error('canvas.getContext("webgpu") returned null');
    return null;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  // Resize helper: make the canvas backing store match CSS size * DPR
  function resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      return true;
    }
    return false;
  }
  // configure context and create a depth texture sized to the canvas
  function configureContext() {
    // ensure canvas size is up to date
    resizeCanvasToDisplaySize();
    context.configure({
      device: device,
      format: format,
      alphaMode: "opaque",
    });
    // Create a depth texture for depth testing
    const depthTexture = device.createTexture({
      size: [canvas.width, canvas.height, 1],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return depthTexture;
  }
  // Initial configuration
  let depthTexture = configureContext();
  // Resize handler that reconfigures the context and re-creates the depth texture
  function onResize() {
    const changed = resizeCanvasToDisplaySize();
    if (changed) {
      // re-configure and re-create depth texture
      depthTexture = configureContext();
    }
  }
  // Provide helper to get current swap chain view and depth view for render pass
  function getCurrentViews() {
    const currentTexture = context.getCurrentTexture();
    const view = currentTexture.createView();
    const depthView = depthTexture.createView();
    return { view, depthView };
  }
  // Provide a simple API surface similar to the WebGL helper used in the project
  return {
    device,
    queue: device.queue,
    context,
    format,
    getCurrentViews,
    configureContext,
    onResize,
    resizeCanvasToDisplaySize,
    adapter,
  };
}
// Helper to create an empty uniform buffer of a given byte size
function createUniformBuffer(device, byteSize) {
  return device.createBuffer({
    size: (byteSize + 15) & ~15, // 16-byte aligned
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}
// Expose simple global helpers (non-module style to match project scripts)
window.initializeWebGPU = initializeWebGPU;
window.createUniformBuffer = createUniformBuffer;
