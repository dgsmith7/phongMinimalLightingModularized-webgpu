// Geometry utilities
// Note: winding convention
// - This generator produces triangles using a left-hand winding order
//   (see triangle push order below). WebGPU's `frontFace` default is
//   counter-clockwise (ccw), so keep this in mind when setting pipeline
//   frontFace/cullMode (we set frontFace='cw' and default to no culling to
//   preserve the original WebGL behavior).
function generateMesh() {
  let meshVertices = [];
  let size = 10;
  let step = 0.1; // smoothness
  let offset = -5;
  function elevation(x, z) {
    // Elevation function,replace this with any other function
    return Math.sin(x) * Math.atan(z);
    // let r = 0.75; // minor radius of half-bagel
    // let bigR = 2.75; // major radius of half-bagel
    // let radiusDiff = Math.sqrt(x ** 2 + z ** 2) - bigR;
    // let y = Math.sqrt(Math.max(0, r ** 2 - radiusDiff ** 2));
    // return y - offset;
  }

  for (let x = -size / 2; x < size / 2; x += step) {
    for (let z = -size / 2; z < size / 2; z += step) {
      // Four adjacent points on the data field (a quad)
      let p1 = [x, elevation(x, z) + offset, z, 1.0];
      let p2 = [x, elevation(x, z + step) + offset, z + step, 1.0];
      let p3 = [x + step, elevation(x + step, z) + offset, z, 1.0];
      let p4 = [
        x + step,
        elevation(x + step, z + step) + offset,
        z + step,
        1.0,
      ];

      // First triangle (p1, p3, p2) - left-hand winding for positive y normals
      meshVertices.push(...p2);
      meshVertices.push(...p1);
      meshVertices.push(...p3);

      // Second triangle (p3, p4, p2) - left-hand winding for positive y normals
      meshVertices.push(...p3);
      meshVertices.push(...p4);
      meshVertices.push(...p2);
    }
  }
  return meshVertices;
}

function computeNormals(array) {
  let nArray = [];
  let pArray = [];
  for (let i = 0; i < array.length; i = i + 12) {
    let a = vec4(array[i], array[i + 1], array[i + 2], 1.0);
    let b = vec4(array[i + 4], array[i + 5], array[i + 6], 1.0);
    let c = vec4(array[i + 8], array[i + 9], array[i + 10], 1.0);
    var t1 = subtract(b, a);
    var t2 = subtract(c, a);
    var n1 = cross(t1, t2);
    let n2 = normalize(n1);
    let normal = vec4(-n2[0], -n2[1], -n2[2], 0.0);
    nArray.push(normal);
    nArray.push(normal);
    nArray.push(normal);
    pArray.push(a);
    pArray.push(b);
    pArray.push(c);
  }
  return { p: pArray, n: nArray };
}
