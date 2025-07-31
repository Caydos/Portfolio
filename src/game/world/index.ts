import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { Renderable } from "../components/renderInstance";
import { Transform } from "../components/transform";
import { createModelMatrix } from "../../engine/render/pipelines/voxel/class";
import { renderData } from "../../engine/render/data";

export let world: IWorld;
export const uniformBuffers = new Map<number, GPUBuffer>();
export const bindGroups = new Map<number, GPUBindGroup>();


export function spawnCubes(
  meshId: number,
  bindGroupLayout: GPUBindGroupLayout,
  size = 20,
  spacing = 1,
  thickness = 5
) {
  console.log(`[render/init.ts::spawnCubes] - meshId : ${meshId}`);

  const device = renderData.device!;
  const halfSize = size / 2;
  const halfThickness = thickness / 2;

  const centerMin = halfSize - halfThickness;
  const centerMax = halfSize + halfThickness;

  function isInCenter(v: number) {
    return v >= centerMin && v < centerMax;
  }

  function createEntityWithGPU(x: number, y: number, z: number) {
    const eid = addEntity(world);

    addComponent(world, Transform, eid);
    Transform.x[eid] = x;
    Transform.y[eid] = y;
    Transform.z[eid] = z;

    const modelMatrix = createModelMatrix(x, y, z);

    const uniformBuffer = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      modelMatrix.buffer,
      modelMatrix.byteOffset,
      modelMatrix.byteLength
    );

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    addComponent(world, Renderable, eid);
    Renderable.meshId[eid] = meshId;
    Renderable.materialId[eid] = 0;

    uniformBuffers.set(eid, uniformBuffer);
    bindGroups.set(eid, bindGroup);
  }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const inX = isInCenter(x);
        const inY = isInCenter(y);
        const inZ = isInCenter(z);

        const centerCount = [inX, inY, inZ].filter(Boolean).length;
        const isOnSurface = x === 0 || x === size - 1 ||
          y === 0 || y === size - 1 ||
          z === 0 || z === size - 1;

        if (centerCount >= 1 && centerCount < 3 && isOnSurface) {
          createEntityWithGPU(
            (x - halfSize) * spacing,
            (y - halfSize) * spacing,
            (z - halfSize) * spacing
          );
        }
      }
    }
  }
}

export function initializeWorld(meshId: number, bindGroupLayout: GPUBindGroupLayout) {
  world = createWorld();
  spawnCubes(meshId, bindGroupLayout, 20, 1, 6); //! HARDCODED mesh ID
}
