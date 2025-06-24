import { render } from '.';
import { device, bindGroup, pipeline, uniformBuffer, vertexBuffer, vertexCount, context, camera, keys } from './init';
import { renderState } from './state';
import { mat4 } from 'gl-matrix';

function handleCameraInput() {
  if (keys.has('w')) camera.moveForward();
  if (keys.has('s')) camera.moveBackward();
  if (keys.has('a')) camera.moveLeft();
  if (keys.has('d')) camera.moveRight();
  if (keys.has('ArrowLeft')) camera.lookLeft();
  if (keys.has('ArrowRight')) camera.lookRight();
  if (keys.has('ArrowUp')) camera.lookUp();
  if (keys.has('ArrowDown')) camera.lookDown();
}

export function tick(delta: number) {
     // console.log(`Rendering frame with dt: ${delta}`);
     handleCameraInput();
       const textureView = context.getCurrentTexture().createView();
  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });

  const aspect = context.canvas.width / context.canvas.height;
  const projMatrix = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100);
  const viewMatrix = camera.getViewMatrix();


  const vp = mat4.create();
  mat4.multiply(vp, projMatrix, viewMatrix);
  device.queue.writeBuffer(uniformBuffer, 0, vp as Float32Array);
  
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setBindGroup(0, bindGroup);
  pass.draw(vertexCount);
  pass.end();
  device.queue.submit([commandEncoder.finish()]);
  
}
