type Mesh = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
};

export class MeshManager {
  private meshes = new Map<number, Mesh>();
  private nextId = 1;

  constructor(private device: GPUDevice) {}

  registerMesh(mesh: Mesh): number {
    const id = this.nextId++;
    this.meshes.set(id, mesh);
    return id;
  }

  getMesh(id: number): Mesh | undefined {
    return this.meshes.get(id);
  }
}
