// WGSL shader replacements for the original GLSL shaders. The original GLSL
// is intentionally omitted here to keep the file focused on WGSL. These
// strings provide a near line-by-line mapping of the Phong lighting vertex
// and fragment stages so students can compare the two approaches during the
// migration exercise.
//
// Notes on GLSL -> WGSL differences (high level):
// - GLSL uses qualifiers like `layout(location = X)` and built-in
//   variables such as `gl_Position`. WGSL uses `@location(X)` and
//   `@builtin(position)` annotations instead.
// - Uniform blocks in GLSL map to `var<uniform>` with explicit structs in
//   WGSL. WGSL enforces much stricter alignment rules; matrices are often
//   represented as arrays of vec4 to ensure 16-byte alignment.
// - GLSL `in`/`out` varyings become WGSL `@location` struct fields; there
//   is no implicit linking — the types and locations must match exactly.
// - WGSL syntax for entry points uses `@vertex` / `@fragment` annotations
//   and explicit function signatures instead of gl-specific function names.
// - Be mindful of row-major vs column-major conventions: this project keeps
//   column-major matrices (flattened as columns) to match WGSL's `mat4x4`
//   expectation when constructed from `array<vec4<f32>,4>`.

// Full Phong lighting in WGSL mirroring the original GLSL implementation.
// The Uniforms struct is laid out to match the Float32Array packing in
// `main.js::packUniforms()` so the MVP, normal matrix, light and material
// products are available with correct alignment.
const wgslVertexSource = `
struct Uniforms {
  mvp : array<vec4<f32>, 4>,
  modelView : array<vec4<f32>, 4>,
  normalMatrix : array<vec4<f32>, 4>,
  lightPosition : vec4<f32>,
  ambientProduct : vec4<f32>,
  diffuseProduct : vec4<f32>,
  specularProduct : vec4<f32>,
  shininess_and_pad : vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
}

struct Varyings {
  @location(0) N : vec3<f32>,
  @location(1) L : vec3<f32>,
  @location(2) E : vec3<f32>,
  @builtin(position) Position : vec4<f32>,
}

@vertex
fn main(in : VertexInput) -> Varyings {
  var out : Varyings;
  let m : mat4x4<f32> = mat4x4<f32>(uniforms.mvp[0], uniforms.mvp[1], uniforms.mvp[2], uniforms.mvp[3]);
  let mv : mat4x4<f32> = mat4x4<f32>(uniforms.modelView[0], uniforms.modelView[1], uniforms.modelView[2], uniforms.modelView[3]);
  let nm : mat4x4<f32> = mat4x4<f32>(uniforms.normalMatrix[0], uniforms.normalMatrix[1], uniforms.normalMatrix[2], uniforms.normalMatrix[3]);
  // compute position in eye-space for lighting (use modelView), but use m (MVP) to produce clip-space Position
  let pos = (mv * vec4<f32>(in.position, 1.0)).xyz;
  if (uniforms.lightPosition.w == 0.0) {
    out.L = normalize(uniforms.lightPosition.xyz);
  } else {
    out.L = normalize(uniforms.lightPosition.xyz - pos);
  }
  out.E = -normalize(pos);
  out.N = normalize((nm * vec4<f32>(in.normal, 0.0)).xyz);
  out.Position = m * vec4<f32>(in.position, 1.0);
  return out;
}
`;

const wgslFragmentSource = `
struct Uniforms {
  mvp : array<vec4<f32>, 4>,
  modelView : array<vec4<f32>, 4>,
  normalMatrix : array<vec4<f32>, 4>,
  lightPosition : vec4<f32>,
  ambientProduct : vec4<f32>,
  diffuseProduct : vec4<f32>,
  specularProduct : vec4<f32>,
  shininess_and_pad : vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@fragment
fn main(@location(0) N : vec3<f32>, @location(1) L : vec3<f32>, @location(2) E : vec3<f32>) -> @location(0) vec4<f32> {
  let H = normalize(L + E);
  let ambient = uniforms.ambientProduct;
  let Kd = max(dot(L, N), 0.0);
  let diffuse = vec4<f32>(Kd) * uniforms.diffuseProduct;
  let Ks = pow(max(dot(N, H), 0.0), uniforms.shininess_and_pad.x);
  var specular = vec4<f32>(Ks) * uniforms.specularProduct;
  if (dot(L, N) < 0.0) {
    specular = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  var color = ambient + diffuse + specular;
  color.a = 1.0;
  return color;
}
`;

// Expose WGSL sources for use by the WebGPU pipeline creation code.
window.wgslVertexSource = wgslVertexSource;
window.wgslFragmentSource = wgslFragmentSource;
// Production: wgslVertexSource and wgslFragmentSource exported above.
