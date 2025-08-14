import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import { Renderable } from "../components/renderInstance";
import { Transform } from "../components/transform";
import { createModelMatrix } from "../../engine/render/pipelines/voxel/class";
import { renderData } from "../../engine/render/data";
import { GlowyEdge, GlowyEdgeMask } from "../components/glowyEdge";

export let world: IWorld;
export const uniformBuffers = new Map<number, GPUBuffer>();
export const bindGroups = new Map<number, GPUBindGroup>();

const inBounds = (x: number, y: number, z: number, size: number) =>
     x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size;

function isVoxelSolid(
     x: number,
     y: number,
     z: number,
     size: number,
     thickness: number
): boolean {
     if (!inBounds(x, y, z, size)) return false;
     const halfSize = size / 2;
     const halfThickness = thickness / 2;
     const centerMin = halfSize - halfThickness;
     const centerMax = halfSize + halfThickness;

     const inX = x >= centerMin && x < centerMax;
     const inY = y >= centerMin && y < centerMax;
     const inZ = z >= centerMin && z < centerMax;

     const centerCount = (inX ? 1 : 0) + (inY ? 1 : 0) + (inZ ? 1 : 0);
     const isOnSurface =
          x === 0 ||
          x === size - 1 ||
          y === 0 ||
          y === size - 1 ||
          z === 0 ||
          z === size - 1;

     return centerCount >= 1 && centerCount < 3 && isOnSurface;
}

const emptyInterior = (
     x: number,
     y: number,
     z: number,
     size: number,
     thickness: number
) => inBounds(x, y, z, size) && !isVoxelSolid(x, y, z, size, thickness);

export function edgeMaskForVoxel(
     x: number,
     y: number,
     z: number,
     size: number,
     thickness: number
): GlowyEdgeMask {
     if (!isVoxelSolid(x, y, z, size, thickness)) return 0 as GlowyEdgeMask;

     let mask = 0 as GlowyEdgeMask;

     // X by Y,Z -> bits 8..11
     if (
          emptyInterior(x, y + 1, z, size, thickness) &&
          emptyInterior(x, y, z + 1, size, thickness)
     )
          mask |= GlowyEdgeMask.X_PosY_PosZ;
     if (
          emptyInterior(x, y + 1, z, size, thickness) &&
          emptyInterior(x, y, z - 1, size, thickness)
     )
          mask |= GlowyEdgeMask.X_PosY_NegZ;
     if (
          emptyInterior(x, y - 1, z, size, thickness) &&
          emptyInterior(x, y, z + 1, size, thickness)
     )
          mask |= GlowyEdgeMask.X_NegY_PosZ;
     if (
          emptyInterior(x, y - 1, z, size, thickness) &&
          emptyInterior(x, y, z - 1, size, thickness)
     )
          mask |= GlowyEdgeMask.X_NegY_NegZ;

     // Y by X,Z -> bits 4..7
     if (
          emptyInterior(x + 1, y, z, size, thickness) &&
          emptyInterior(x, y, z + 1, size, thickness)
     )
          mask |= GlowyEdgeMask.Y_PosX_PosZ;
     if (
          emptyInterior(x + 1, y, z, size, thickness) &&
          emptyInterior(x, y, z - 1, size, thickness)
     )
          mask |= GlowyEdgeMask.Y_PosX_NegZ;
     if (
          emptyInterior(x - 1, y, z, size, thickness) &&
          emptyInterior(x, y, z + 1, size, thickness)
     )
          mask |= GlowyEdgeMask.Y_NegX_PosZ;
     if (
          emptyInterior(x - 1, y, z, size, thickness) &&
          emptyInterior(x, y, z - 1, size, thickness)
     )
          mask |= GlowyEdgeMask.Y_NegX_NegZ;

     // Z by X,Y -> bits 0..3
     if (
          emptyInterior(x + 1, y, z, size, thickness) &&
          emptyInterior(x, y + 1, z, size, thickness)
     )
          mask |= GlowyEdgeMask.Z_PosX_PosY;
     if (
          emptyInterior(x + 1, y, z, size, thickness) &&
          emptyInterior(x, y - 1, z, size, thickness)
     )
          mask |= GlowyEdgeMask.Z_PosX_NegY;
     if (
          emptyInterior(x - 1, y, z, size, thickness) &&
          emptyInterior(x, y + 1, z, size, thickness)
     )
          mask |= GlowyEdgeMask.Z_NegX_PosY;
     if (
          emptyInterior(x - 1, y, z, size, thickness) &&
          emptyInterior(x, y - 1, z, size, thickness)
     )
          mask |= GlowyEdgeMask.Z_NegX_NegY;

     return mask;
}

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

     function createEntityWithGPU(
          x: number,
          y: number,
          z: number,
          edgeMask: GlowyEdgeMask
     ) {
          const eid = addEntity(world);

          addComponent(world, Transform, eid);
          addComponent(world, GlowyEdge, eid);
          GlowyEdge.mask[eid] = edgeMask;
          Transform.x[eid] = x;
          Transform.y[eid] = y;
          Transform.z[eid] = z;

          const modelMatrix = createModelMatrix(x, y, z);

          const uniformBuffer = device.createBuffer({
               size: 80,
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
                    const isOnSurface =
                         x === 0 ||
                         x === size - 1 ||
                         y === 0 ||
                         y === size - 1 ||
                         z === 0 ||
                         z === size - 1;
                    //centerCount == 2 -> portals
                    if (centerCount >= 1 && centerCount < 3 && isOnSurface) {
                         const mask = edgeMaskForVoxel(
                              x,
                              y,
                              z,
                              size,
                              thickness
                         );

                         createEntityWithGPU(
                              (x - halfSize) * spacing,
                              (y - halfSize) * spacing,
                              (z - halfSize) * spacing,
                              mask
                         );
                    }
               }
          }
     }
}

export function initializeWorld(
     meshId: number,
     bindGroupLayout: GPUBindGroupLayout
) {
     world = createWorld();
     spawnCubes(meshId, bindGroupLayout, 20, 1, 6); //! HARDCODED mesh ID
}
