// Buffer helpers for both WebGL and WebGPU contexts.
// Differences to note:
// - WebGL: you create buffers with gl.createBuffer(), bind them to a target
//   (ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER) and call gl.bufferData. Attribute
//   state is enabled/disabled via gl.enableVertexAttribArray.
// - WebGPU: buffers are created from the `GPUDevice` and described with a
//   usage flag. Vertex attribute descriptions (stride/format/location)
//   are provided when creating the pipeline, not at buffer bind time.
function createBuffer(
  gl,
  data,
  type = gl.ARRAY_BUFFER,
  usage = gl.STATIC_DRAW
) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(type, buffer);
  gl.bufferData(type, data, usage);
  return buffer;
}

function bindBuffer(
  gl,
  buffer,
  attribute,
  size,
  type = gl.FLOAT,
  normalize = false,
  stride = 0,
  offset = 0
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(attribute, size, type, normalize, stride, offset);
  gl.enableVertexAttribArray(attribute);
}

// ---------------------------------------------------------------------------
// WebGPU helpers (non-destructive additions). These are convenience wrappers
// so the project can progressively call the same logical helpers while
// migrating from WebGL to WebGPU. If `device` is not available the functions
// will throw to make usage explicit.
//
// createGPUVertexBuffer(device, float32Array)
// createGPUIndexBuffer(device, typedIndexArray)
// interleaveVertexData(positionsArray, normalsArray)
// ---------------------------------------------------------------------------

// WebGPU convenience helpers. These mirror the simpler WebGL helpers above
// but are specific to GPU buffers and handle mapping/unmapping for
// initialization. Note the byte-alignment paddings to satisfy WebGPU
// requirements (pad to 4 bytes, align uniform buffers to 16 bytes elsewhere).
function createGPUVertexBuffer(
  device,
  float32Array,
  usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
) {
  if (!device) throw new Error("createGPUVertexBuffer: device is required");
  const arrayBuffer = float32Array.buffer ? float32Array.buffer : float32Array;
  const buffer = device.createBuffer({
    size: (arrayBuffer.byteLength + 3) & ~3,
    usage: usage,
    mappedAtCreation: true,
  });
  const mapping = new Uint8Array(buffer.getMappedRange());
  mapping.set(new Uint8Array(arrayBuffer));
  buffer.unmap();
  return buffer;
}

function createGPUIndexBuffer(
  device,
  indexArray,
  usage = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
) {
  if (!device) throw new Error("createGPUIndexBuffer: device is required");
  const arrayBuffer = indexArray.buffer ? indexArray.buffer : indexArray;
  const buffer = device.createBuffer({
    size: (arrayBuffer.byteLength + 3) & ~3,
    usage: usage,
    mappedAtCreation: true,
  });
  const mapping = new Uint8Array(buffer.getMappedRange());
  mapping.set(new Uint8Array(arrayBuffer));
  buffer.unmap();
  return buffer;
}

// Convert separated position and normal arrays (arrays of vec4) into an
// interleaved Float32Array with layout: [x,y,z, nx,ny,nz] per vertex.
// positionsArray and normalsArray are expected to be arrays of vec4 objects
// (the same format produced by computeNormals()).
function interleaveVertexData(positionsArray, normalsArray) {
  if (!positionsArray || !normalsArray) return new Float32Array();
  const n = positionsArray.length;
  const stride = 6; // 3 pos + 3 normal
  const out = new Float32Array(n * stride);
  for (let i = 0; i < n; ++i) {
    const p = positionsArray[i];
    const nm = normalsArray[i];
    // positionsArray entries are vec4-like arrays [x,y,z,w]
    out[i * stride + 0] = p[0];
    out[i * stride + 1] = p[1];
    out[i * stride + 2] = p[2];
    // normals are vec4-like with w=0.0
    out[i * stride + 3] = nm[0];
    out[i * stride + 4] = nm[1];
    out[i * stride + 5] = nm[2];
  }
  return out;
}

// Expose GPU helpers globally (non-module style to match existing project)
window.createGPUVertexBuffer = createGPUVertexBuffer;
window.createGPUIndexBuffer = createGPUIndexBuffer;
window.interleaveVertexData = interleaveVertexData;
