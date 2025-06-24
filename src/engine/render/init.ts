import { createCubeGeometry } from '../../game/geometry/cube';
import { renderState } from './state';
import { mat4 } from 'gl-matrix';
import { generateTesseractEdges, generateTesseractVertices, projectTo3D } from './tesseract';
import { Camera } from './camera';


export let device: GPUDevice;
export let context: GPUCanvasContext;
export let format: GPUTextureFormat;
export let pipeline!: GPURenderPipeline;
export let vertexBuffer!: GPUBuffer;
export let uniformBuffer!: GPUBuffer;
export let bindGroup!: GPUBindGroup;
export let vertexCount = 0;
export let camera: Camera;
export let keys = new Set<string>();

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
  // setupMouse();

  window.addEventListener('keydown', (e) => keys.add(e.key));
  window.addEventListener('keyup', (e) => keys.delete(e.key));



  camera = new Camera();
  // Will need to be moved out of here
  const res = await fetch('dist/shaders/shader.wgsl');
  const code = await res.text();

  const vertices4D = generateTesseractVertices();
  const edges = generateTesseractEdges();

  const edgeVertices: number[] = [];

  for (const [i, j] of edges) {
    const v1 = projectTo3D(vertices4D[i]);
    const v2 = projectTo3D(vertices4D[j]);
    edgeVertices.push(...v1, ...v2);
  }

  vertexCount = edgeVertices.length / 3;

  vertexBuffer = device.createBuffer({
    size: edgeVertices.length * 4,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(edgeVertices);
  vertexBuffer.unmap();

  uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({
    code: code,
  });

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: 'bgra8unorm' }],
    },
    primitive: {
      topology: 'line-list',
    },
  });

  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer },
    }],
  });
}
