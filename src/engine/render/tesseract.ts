export type Vec4 = [number, number, number, number];

export function generateTesseractVertices(): Vec4[] {
  const vertices: Vec4[] = [];
  for (let i = 0; i < 16; i++) {
    vertices.push([
      (i & 1) ? 1 : -1,
      (i & 2) ? 1 : -1,
      (i & 4) ? 1 : -1,
      (i & 8) ? 1 : -1,
    ]);
  }
  return vertices;
}
export function generateTesseractEdges(): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      const diff = (i ^ j);
      // If they differ by exactly one bit, it's an edge
      if ((diff & (diff - 1)) === 0) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

export function projectTo3D([x, y, z, w]: Vec4): [number, number, number] {
  const scale = 1 / (2 - w);
  return [x * scale, y * scale, z * scale];
}
