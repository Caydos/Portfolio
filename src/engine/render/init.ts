import * as cube from '../../game/geometry/cube';
import { renderData } from './data';
import { mat4 } from 'gl-matrix';
import * as pipelines from './pipelines';
import { addComponent, addEntity } from 'bitecs';
import { initializeWorld, world } from '../../game/world';
import { Transform } from '../../game/components/transform';
import { Renderable } from '../../game/components/renderInstance';
import { MeshManager } from './classes/mesh';
import { render } from '.';
import { Camera } from '../../game/camera';

// function setupMouse() {
//   const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
//   let dragging = false;
//   let lastX = 0, lastY = 0;

//   canvas.addEventListener('mousedown', (e) => {
//     dragging = true;
//     lastX = e.clientX;
//     lastY = e.clientY;
//   });

//   canvas.addEventListener('mouseup', () => dragging = false);
//   canvas.addEventListener('mouseleave', () => dragging = false);

//   canvas.addEventListener('mousemove', (e) => {
//     if (!dragging) return;
//     const dx = (e.clientX - lastX) * 0.01;
//     const dy = (e.clientY - lastY) * 0.01;
//     renderData.rotation.x += dx;
//     renderData.rotation.y += dy;
//     lastX = e.clientX;
//     lastY = e.clientY;
//     console.log(`${renderState.rotation.x}, ${renderState.rotation.y}`);
//   });
// }

export async function init() {
  if (!navigator.gpu) {
    console.error("WebGPU not supported.");
    return;
  }
  renderData.canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  renderData.adapter = await navigator.gpu.requestAdapter();
  renderData.device = await renderData.adapter?.requestDevice()!;
  renderData.context = renderData.canvas.getContext("webgpu") as GPUCanvasContext;
  renderData.format = navigator.gpu.getPreferredCanvasFormat();

  renderData.context.configure({
    device: renderData.device,
    format: renderData.format,
    alphaMode: "opaque",
  });
  renderData.camera = new Camera(45, renderData.canvas.width / renderData.canvas.height);
  renderData.meshManager = new MeshManager(render.device);
  await pipelines.initialize();

  let id = renderData.meshManager?.registerMesh(cube.createMesh(renderData.device));
  if (id == undefined) {
    console.log(`[render.ts::init] - Failed to generate cube mesh`);
    return;
  }
  const modelBindGroupLayout = pipelines.voxelPipeline.getPass(0)!.getPipeline().getBindGroupLayout(1);

  initializeWorld(id, modelBindGroupLayout);
}
