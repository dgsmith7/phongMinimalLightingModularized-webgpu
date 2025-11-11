## Migration Notes — GLSL (WebGL) → WGSL (WebGPU)

This file collects the most useful, practical notes for students migrating a small Phong demo from WebGL/GLSL to WebGPU/WGSL. It focuses on the differences that commonly break visuals: coordinate spaces, uniform packing, matrix conventions, attribute bindings, and debugging techniques.

---

### 1) High-level mapping

- WebGL (GLSL) concepts:

  - `attribute`, `varying`, `uniform` blocks
  - `gl_Position`, `gl_FragColor`, `gl_FragCoord`
  - Clip space z range: [-1, 1]
  - Default face winding: CCW

- WebGPU (WGSL) equivalents:
  - `@location(n)` for vertex outputs and fragment inputs
  - `@builtin(position)` for clip-space output
  - Uniform buffers are structs with explicit `@group`/`@binding` in pipeline bind groups
  - Clip space z range: [0, 1] (important — see projection correction)
  - Default face winding is the same conceptually; however, WebGPU pipeline `frontFace` defaults can differ and must match your mesh winding

---

### 2) WGSL snippets: side-by-side

- GLSL (vertex)

```glsl
// GLSL ES 3.0
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(std140) uniform Uniforms {
  mat4 u_mvp;
  mat4 u_modelView;
  mat3 u_normalMat;
  vec4 u_lightPos;
  vec4 u_ambient;
  vec4 u_diffuse;
  vec4 u_specular;
  float u_shininess;
};
out vec3 v_normal;
void main() {
  v_normal = (u_normalMat * a_normal);
  gl_Position = u_mvp * vec4(a_position, 1.0);
}
```

- WGSL (vertex)

```wgsl
struct Uniforms {
  mvp: mat4x4<f32>;
  modelView: mat4x4<f32>;
  normalMat4: mat4x4<f32>; // pad to 16-byte alignment
  lightPos: vec4<f32>;
  ambientProduct: vec4<f32>;
  diffuseProduct: vec4<f32>;
  specularProduct: vec4<f32>;
  shininess_and_pad: vec4<f32>; // pack shininess into .x
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
  @builtin(position) Position : vec4<f32>;
  @location(0) normal : vec3<f32>;
  @location(1) posEye : vec3<f32>; // optional
};

@vertex
fn vs_main(@location(0) pos: vec3<f32>, @location(1) normal: vec3<f32>) -> VertexOut {
  var out: VertexOut;
  out.Position = uniforms.mvp * vec4<f32>(pos, 1.0);
  // For lighting: operate in eye-space using modelView
  let posEye4 = uniforms.modelView * vec4<f32>(pos, 1.0);
  out.posEye = posEye4.xyz;
  out.normal = (uniforms.normalMat4 * vec4<f32>(normal, 0.0)).xyz;
  return out;
}
```

Notes:

- WGSL `@location` and `@builtin` annotations are explicit. Order and locations must match pipeline descriptors and JS bind groups.
- Pack normal matrix into a mat4x4 if you want to avoid padding surprises in uniform buffers; many implementations use a mat4 copy of a mat3.

---

### 3) Uniform buffer packing and alignment (practical rules)

- WGSL uniform buffers follow 16-byte alignment rules: a `vec3<f32>` is aligned/padded to 16 bytes. `mat3x3` has awkward layout; prefer storing a `mat4x4` where the last column is unused padding.
- Common pattern used in this project: pack these entries as 16-byte-aligned elements in a Float32Array:
  - mvp (mat4) — 16 floats
  - modelView (mat4) — 16 floats
  - normalMat4 (mat4 holding inverse-transpose 3x3 in the top-left) — 16 floats
  - lightPos (vec4) — 4 floats
  - ambientProduct (vec4) — 4 floats
  - diffuseProduct (vec4) — 4 floats
  - specularProduct (vec4) — 4 floats
  - shininess_and_pad (vec4) — 4 floats (shininess in .x)

Total: 68 floats; allocate a GPU uniform buffer sized to 68 \* 4 bytes and write with queue.writeBuffer every frame (or when changed).

---

### 4) Matrices & coordinate spaces

- Column-major vs row-major

  - WebGL (GLSL) expects column-major matrices by default if you use JavaScript typed arrays with column-major layout. In this repo `flatten()` writes column-major layout (compatible with GLSL `mat4` multiplication `m * v`). Keep the same convention when packing matrices for WGSL.

- Depth (Z) mapping
  - WebGL clip-space Z: [-1, +1]
  - WebGPU clip-space Z: [0, +1]
  - If you reuse a projection matrix made for WebGL, apply a small correction to map Z properly. Example: multiply the projection by

```text
  C = mat4(1,0,0,0,
           0,1,0,0,
           0,0,0.5,0,
           0,0,0.5,1)
```

This maps z' = 0.5\*z + 0.5, converting [-1,1] → [0,1].

- Y-flip
  - Depending on how you construct your projection, you may also need to flip Y. The safest approach is to construct the projection explicitly for WebGPU (same math but with z corrected). If you must reuse WebGL projection matrices, multiply by a Y flip matrix.

---

### 5) Attribute bindings and vertex layout

- In WebGL you may rely on `location` qualifiers in GLSL, but in WebGPU you must declare vertex buffer layouts in the pipeline descriptor. Example used in the project:

- JS pipeline descriptor snippet

```js
vertex: {
  module: vsModule,
  entryPoint: 'vs_main',
  buffers: [{
    arrayStride: 24, // 3 floats pos + 3 floats normal
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },
      { shaderLocation: 1, offset: 12, format: 'float32x3' }
    ]
  }]
}
```

Make sure the `@location` indices in WGSL match `shaderLocation` here.

---

### 6) Face winding & culling

- WebGL defaults and authoring tools often use CCW winding. If your generator produces opposite winding, triangles will be culled in WebGPU if `cullMode`/`frontFace` disagree.
- Quick debug technique: temporarily disable culling (`cullMode: 'none'`) and disable depth to confirm geometry reaches the pipeline. If all geometry becomes visible (or magenta with test shader), winding/culling is the cause.

In this project we kept double-sided rendering by default (no back-face culling) to match the original WebGL behavior.

---

### 7) Common gotchas & troubleshooting checklist

1. Shader fails to compile — check WGSL syntax: `var<uniform>`, `@binding`, `@group`, `@location`, `@builtin(position)`.
2. Black or partly-lit mesh — verify you compute lighting in the same space (modelView/eye-space vs world-space). Pack and use a `modelView` matrix for lighting calculations.
3. Missing triangles that appear/disappear with camera — check culling/winding and depth test. Re-run with culling off and depth disabled to confirm.
4. Strange lighting normals — ensure normal matrix is inverse-transpose of the modelView 3x3. Because of uniform layout, consider storing a mat4 copy of the normal matrix in the uniform buffer.
5. Uniform mismatch — dump the first 16 floats of your uniform buffer in JS and compare to what the shader expects (order & padding). A single float out of place will produce incorrect vertex position or lighting.
6. Z-clipping — remember WebGPU NDC z is [0,1] — apply projection correction if reusing a WebGL projection.

---

### 8) Debugging recipes used in this project (recommended for students)

1. Magenta fragment shader: replace the fragment shader with a constant magenta output to confirm the vertex pipeline and attribute bindings are correct.
2. Disable depth/culling: set `depthWriteEnabled: false`, `depthCompare: 'always'`, and `cullMode: 'none'` in the pipeline temporarily to confirm geometry reaches the rasterizer.
3. Console dump: print the first N interleaved vertex floats and first N packed uniform floats to verify ordering. Example:

```js
console.log(new Float32Array(vertexBufferData.buffer, 0, 8));
console.log(uniformsFloat32Array.slice(0, 32));
```

4. Swap frontFace: try `frontFace: 'cw'` if your generator used left-hand winding.

---

### 9) Run & test locally

Start a local static server (from the project root) and open in Chromium/Chrome with WebGPU enabled (modern Chrome stable supports WebGPU). Example:

```bash
# from project root
python3 -m http.server 8000
# then open http://localhost:8000 in Chrome/Chromium
```

If you use an older browser build, enable WebGPU flags or use Chrome Canary. Prefer the latest stable Chromium if possible.

---

### 10) Follow-up ideas (optional classroom exercises)

- Flip the mesh generator to produce CCW winding and enable `cullMode: 'back'` + `frontFace: 'ccw'` to practice single-sided rendering and learn about winding.
- Create a small side-by-side page that renders the original GLSL shader (WebGL) next to the WGSL shader (WebGPU) to let students step through differences interactively.
- Add a small unit test that validates the uniform buffer layout (compare typed-array byte offsets against expected offsets).

---

If you'd like, I can also add a short `MIGRATION_EXAMPLES.md` that contains a few more line-by-line translations (e.g., GLSL `normalize()` vs WGSL `normalize()`, common function name changes, and how to port `texture()` calls). For tonight I've kept the notes focused and practical so students can reproduce the demo reliably.

-- End of MIGRATION_NOTES
