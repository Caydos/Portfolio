import { createCubeGeometry } from '../../game/geometry/cube';
import { renderState } from './state';
import { mat4 } from 'gl-matrix';


let device: GPUDevice;
let context: GPUCanvasContext;
let format: GPUTextureFormat;


function setupMouse() {
  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
  let dragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => dragging = false);
  canvas.addEventListener('mouseleave', () => dragging = false);

  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) * 0.01;
    const dy = (e.clientY - lastY) * 0.01;
    renderState.rotation.x += dx;
    renderState.rotation.y += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    console.log(`${renderState.rotation.x}, ${renderState.rotation.y}`);
  });
}

export async function init() {
  if (!navigator.gpu) {
    console.error("WebGPU not supported.");
    return;
  }

  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter?.requestDevice()!;
  context = canvas.getContext("webgpu") as GPUCanvasContext;
  format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });
  setupMouse();






  // Will need to be moved out of here
  const res = await fetch('dist/shaders/shader.wgsl');
  const code = await res.text();

  const shader = device.createShaderModule({ code });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 4 * 3,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
        },
      ],
    },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const { vertexData, indexData } = createCubeGeometry();
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint16Array(indexBuffer.getMappedRange()).set(indexData);
  indexBuffer.unmap();

  Object.assign(renderState, {
    device,
    context,
    pipeline,
    vertexBuffer,
    indexBuffer,
    depthTexture,
  });

  const uniformBuffer = device.createBuffer({
    size: 64, // 4x4 matrix
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  Object.assign(renderState, {
    uniformBuffer,
    uniformBindGroup,
  });
}
