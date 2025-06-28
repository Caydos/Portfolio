/**
 * @brief shared data for the rendering environment
 */
export const renderData = {
  canvas: null as HTMLCanvasElement | null,
  adapter: null as GPUAdapter | null,
  device: null as GPUDevice | null,
  context: null as GPUCanvasContext | null,
  format: null as GPUTextureFormat | null,
};
