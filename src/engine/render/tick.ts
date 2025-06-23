import { render } from '.';
import { renderState } from './state';
import { mat4 } from 'gl-matrix';

export function tick(delta: number) {
     // console.log(`Rendering frame with dt: ${delta}`);
      const { device, context, pipeline, vertexBuffer, indexBuffer, depthTexture, uniformBuffer, uniformBindGroup } = renderState;
  if (!device || !context || !pipeline) return;

  const model = mat4.create();
  mat4.rotateX(model, model, renderState.rotation.y);
  mat4.rotateY(model, model, renderState.rotation.x);

  const view = mat4.create();
  mat4.lookAt(view, [0, 0, 4], [0, 0, 0], [0, 1, 0]);

  const proj = mat4.create();
  const aspect = (context as any).canvas.width / (context as any).canvas.height;
  mat4.perspective(proj, Math.PI / 4, aspect, 0.1, 100);

  mat4.multiply(renderState.mvpMatrix, proj, view);
  mat4.multiply(renderState.mvpMatrix, renderState.mvpMatrix, model);

  device.queue.writeBuffer(uniformBuffer!, 0, renderState.mvpMatrix as Float32Array);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1 },
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture!.createView(),
      depthLoadOp: 'clear',
      depthClearValue: 1.0,
      depthStoreOp: 'store',
    },
  });

  pass.setPipeline(pipeline!);
  pass.setBindGroup(0, uniformBindGroup!);
  pass.setVertexBuffer(0, vertexBuffer!);
  pass.setIndexBuffer(indexBuffer!, 'uint16');
  pass.drawIndexed(36);
  pass.end();

  device.queue.submit([encoder.finish()]);
}
