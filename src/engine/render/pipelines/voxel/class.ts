import { defineQuery } from "bitecs";
import { Pipeline } from "../../classes/pipeline";
import { Transform } from "../../../../game/components/transform";
import { Renderable } from "../../../../game/components/renderInstance";
import { world } from "../../../../game/world";
import { renderData } from "../../data";
import { mat4 } from "gl-matrix";
import { VoxelPassType } from "./passes/enum";

const query = defineQuery([Transform, Renderable]);
export function createModelMatrix(x: number, y: number, z: number): Float32Array {
    const out = mat4.create(); // creates a Float32Array
    mat4.translate(out, out, [x, y, z]);
    return out as Float32Array;
}
export class VoxelPipeline extends Pipeline {
    public uniformBuffer!: GPUBuffer;
    public bindGroup!: GPUBindGroup;
    constructor(device: GPUDevice, width: number, height: number) {
        super(device, renderData.canvas!);
    }

    public override tick(delta: number, passEncoder: GPURenderPassEncoder) {
        const { device, meshManager, camera } = renderData;
        const entities = query(world);
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            console.log(`Drawing cube at : ${Transform.x[eid]},${Transform.y[eid]},${Transform.z[eid]}`);
            const modelMatrix = createModelMatrix(
                Transform.x[eid],
                Transform.y[eid],
                Transform.z[eid]
            ) as Float32Array;

            const viewProjMatrix = camera!.viewProjMatrix as Float32Array;

            device!.queue.writeBuffer(
                this.uniformBuffer,
                0,
                modelMatrix.buffer,
                modelMatrix.byteOffset,
                modelMatrix.byteLength
            );

            device!.queue.writeBuffer(
                this.uniformBuffer,
                64,
                viewProjMatrix.buffer,
                viewProjMatrix.byteOffset,
                viewProjMatrix.byteLength
            );

            const mesh = meshManager!.getMesh(Renderable.meshId[eid]);
            if (!mesh) continue;
            const pipeline = this.getPass(0)?.getPipeline();
            if (!pipeline) return;
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
            passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint16');
            passEncoder.drawIndexed(mesh.indexCount, 1);
        }

    }
}