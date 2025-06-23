export function createCubeGeometry() {
  const positions = [
    // front
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,
    // back
    -1, -1, -1,
     1, -1, -1,
     1,  1, -1,
    -1,  1, -1,
  ];

  const indices = [
    // front
    0, 1, 2, 0, 2, 3,
    // right
    1, 5, 6, 1, 6, 2,
    // back
    5, 4, 7, 5, 7, 6,
    // left
    4, 0, 3, 4, 3, 7,
    // top
    3, 2, 6, 3, 6, 7,
    // bottom
    4, 5, 1, 4, 1, 0,
  ];

  return {
    vertexData: new Float32Array(positions),
    indexData: new Uint16Array(indices),
  };
}
