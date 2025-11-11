# Migration Examples — Small GLSL → WGSL Translations

This short file contains compact, practical line-by-line examples that students can use when porting small GLSL idioms to WGSL. Keep it as a quick reference while reading `MIGRATION_NOTES.md`.

## 1) Attributes / varyings / locations

GLSL:

```glsl
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_norm;
out vec3 v_norm;
```

WGSL:

```wgsl
@vertex
fn vs_main(@location(0) pos: vec3<f32>, @location(1) norm: vec3<f32>) -> VertexOut {
  // fill out VertexOut.@location(...) fields
}
```

Key: match `@location` indices with the pipeline's `vertex.buffers[].attributes[].shaderLocation` values.

## 2) Uniform block -> struct binding

GLSL:

```glsl
layout(std140) uniform U {
  mat4 u_mvp;
  vec3 u_light;
};
```

WGSL:

```wgsl
struct U { mvp: mat4x4<f32>; light: vec3<f32>; /* pad */ };
@group(0) @binding(0) var<uniform> u : U;
```

Remember: pad `vec3` fields or pack them as `vec4` to satisfy 16-byte alignment.

## 3) normalize(), dot(), reflect()

GLSL:

```glsl
vec3 N = normalize(v_norm);
float d = max(dot(N, L), 0.0);
vec3 R = reflect(-L, N);
```

WGSL:

```wgsl
let N = normalize(v_norm);
let d = max(dot(N, L), 0.0);
let R = reflect(-L, N);
```

These functions have direct equivalents in WGSL; keep types explicit (vec3<f32>).

## 4) texture sampling (sampler + texture)

GLSL (sampler2D):

```glsl
uniform sampler2D u_tex;
vec4 c = texture(u_tex, uv);
```

WGSL:

```wgsl
@group(0) @binding(1) var u_sampler: sampler;
@group(0) @binding(2) var u_texture: texture_2d<f32>;
let c = textureSample(u_texture, u_sampler, uv);
```

Note: WebGPU separates `sampler` and `texture` into different bindings (often adjacent bindings).

## 5) gl_Position / @builtin(position)

GLSL:

```glsl
gl_Position = u_mvp * vec4(a_pos, 1.0);
```

WGSL:

```wgsl
var out: VertexOut;
out.Position = u.mvp * vec4<f32>(pos, 1.0);
```

And declare `Position` with `@builtin(position)` in the `VertexOut` struct.

## 6) Conditionals & loops

Mostly the same. WGSL is stricter about types and requires explicit returns and explicit loop syntax.

GLSL:

```glsl
for(int i=0;i<4;i++) { sum += a[i]; }
```

WGSL:

```wgsl
var i: i32 = 0;
loop {
  if (i >= 4) { break; }
  sum = sum + a[i];
  i = i + 1;
}
```

Prefer unrolling small fixed-size loops on the JS side where possible to simplify WGSL.

## 7) Built-ins differences

- `gl_FragCoord` -> `@builtin(position)` is available in fragment stage as input.
- There is no `discard` in WGSL; instead, write alpha=0 or use depth/stencil to mask fragments.

## 8) Quick packing example (JS -> uniform buffer)

JS Float32Array packing (example order):

```
[ mvp(16), modelView(16), normalMat4(16), lightPos(4), ambient(4), diffuse(4), specular(4), shininess_pad(4) ]
```

Write with `device.queue.writeBuffer(ub, 0, uniforms.buffer)` or mapAsync for large updates.

---

If you'd like more targeted examples (e.g., porting a particular GLSL extension or a sampler state nuance), tell me which snippet and I'll add it here. I won't change the mesh winding or flip triangles — per your request I left the geometry as-is.
