export function createMesh(device: GPUDevice): { vertexBuffer: GPUBuffer, indexBuffer: GPUBuffer, indexCount: number } {
  const vertexData = new Float32Array([
    // X, Y, Z
    -0.5, -0.5, 0.5,  // front
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5,  // back
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
  ]);

  const indexData = new Uint16Array([
    // Front face (Z+)
    0, 1, 2,
    2, 3, 0,

    // Back face (Z-)
    5, 4, 7,
    7, 6, 5,

    // Left face (X-)
    4, 0, 3,
    3, 7, 4,

    // Right face (X+)
    1, 5, 6,
    6, 2, 1,

    // Top face (Y+)
    3, 2, 6,
    6, 7, 3,

    // Bottom face (Y-)
    4, 5, 1,
    1, 0, 4
  ]);



  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint16Array(indexBuffer.getMappedRange()).set(indexData);
  indexBuffer.unmap();

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: indexData.length,
  };
}
