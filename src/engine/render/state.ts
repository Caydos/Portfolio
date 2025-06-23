import { mat4 } from 'gl-matrix';

export const renderState = {
  device: null as GPUDevice | null,
  context: null as GPUCanvasContext | null,
  format: null as GPUTextureFormat | null,

  // Might needs to be moved elsewhere
  pipeline: null as GPURenderPipeline | null,
  vertexBuffer: null as GPUBuffer | null,
  indexBuffer: null as GPUBuffer | null,
  depthTexture: null as GPUTexture | null,

  uniformBuffer: null as GPUBuffer | null,
  uniformBindGroup: null as GPUBindGroup | null,
  rotation: { x: 0, y: 0 },
  mvpMatrix: mat4.create(),
};
