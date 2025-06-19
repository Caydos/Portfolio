async function initWebGPU() {
  if (!navigator.gpu) {
    console.error("WebGPU not supported.");
    return;
  }

  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();

  const context = canvas.getContext("webgpu") as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device!,
    format: format,
    alphaMode: "opaque",
  });

  const encoder = device!.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0.2, g: 0.2, b: 0.8, a: 1.0 },
    }]
  });
  pass.end();
  device!.queue.submit([encoder.finish()]);
}

initWebGPU();
