import { defineQuery } from "bitecs";
import { Pipeline } from "../../classes/pipeline";
import { Transform } from "../../../../game/components/transform";
import { Renderable } from "../../../../game/components/renderInstance";
import { bindGroups, uniformBuffers, world } from "../../../../game/world";
import { renderData } from "../../data";
import { mat4 } from "gl-matrix";
import { VoxelPassType } from "./passes/enum";
import { GlowyEdge, GlowyEdgeMask } from "../../../../game/components/glowyEdge";

const query = defineQuery([Transform, Renderable]);
export function createModelMatrix(
     x: number,
     y: number,
     z: number
): Float32Array {
     const out = mat4.create();
     mat4.translate(out, out, [x, y, z]);
     return out as Float32Array;
}


export class VoxelPipeline extends Pipeline {
     public globalUniformBuffer!: GPUBuffer;
     public bindGroup!: GPUBindGroup;

     public modelUniformBuffer!: GPUBuffer;
     public modelBindGroup!: GPUBindGroup;
     public totalTime!: number;

     constructor(device: GPUDevice, width: number, height: number) {
          super(device, width, height, "rgba16float");
     }

     public override tick(delta: number, passEncoder: GPURenderPassEncoder) {
          const { device, meshManager, camera } = renderData;
          const entities = query(world);
          const pipeline = this.getPass(0)?.getPipeline();
          if (!pipeline) {
               console.log("No pipeline found operation aborted");
               return;
          }
          if (!camera) {
               console.log("No camera found operation aborted");
               return;
          }
          passEncoder.setPipeline(pipeline);
          passEncoder.setBindGroup(0, this.bindGroup);

          const viewProjMatrix = camera.viewProjMatrix as Float32Array;
          // 16 for matrix, 3 for position, 1 for padding = 20 floats
          const globalUniformData = new Float32Array(24);

          // write matrix (first 16 floats)
          globalUniformData.set(camera.viewProjMatrix, 0);

          // write camera world pos (next 3 floats)
          globalUniformData[16] = camera.position[0];
          globalUniformData[17] = camera.position[1];
          globalUniformData[18] = camera.position[2];

          // write time (1 float)
          if (!this.totalTime) this.totalTime = 0;
          this.totalTime += delta; // delta in seconds
          globalUniformData[19] = this.totalTime;

          // padding (1 float)
          globalUniformData[23] = 0;

          device!.queue.writeBuffer(
               this.globalUniformBuffer,
               0,
               globalUniformData.buffer,
               globalUniformData.byteOffset,
               globalUniformData.byteLength
          );

          for (let i = 0; i < entities.length; i++) {
               const eid = entities[i];
               const uniformBuffer = uniformBuffers.get(eid);
               const bindGroup = bindGroups.get(eid);

               if (!uniformBuffer || !bindGroup) {
                    console.warn(`Missing GPU resources for entity ${eid}`);
                    continue;
               }

               // console.log(`Drawing cube at : ${Transform.x[eid]},${Transform.y[eid]},${Transform.z[eid]}`);
               const modelMatrix = createModelMatrix(
                    Transform.x[eid],
                    Transform.y[eid],
                    Transform.z[eid]
               ) as Float32Array;

               const objectUniformData = new ArrayBuffer(80);
               const f32View = new Float32Array(objectUniformData);
               const u32View = new Uint32Array(objectUniformData);

               f32View.set(modelMatrix, 0);

               u32View[16] = GlowyEdge.mask[eid];

               this.device.queue.writeBuffer(
                    uniformBuffer,
                    0,
                    objectUniformData
               );

               const mesh = meshManager!.getMesh(Renderable.meshId[eid]);
               if (!mesh) {
                    console.log("No mesh found operation aborted");
                    continue;
               }

               passEncoder.setBindGroup(1, bindGroup);
               passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
               passEncoder.setIndexBuffer(mesh.indexBuffer, "uint16");
               passEncoder.drawIndexed(mesh.indexCount, 585);//585
          }
     }
}
