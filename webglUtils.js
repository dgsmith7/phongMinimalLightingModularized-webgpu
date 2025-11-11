function initializeWebGL(canvasId) {
  const canvas = document.getElementById(canvasId);
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL 2.0 not available");
    return null;
  }
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);
  return gl;
}

function initializeShaders(gl, vertexShaderSource, fragmentShaderSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource); // see shaderUtils.js
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  return createProgram(gl, vertexShader, fragmentShader);
}
