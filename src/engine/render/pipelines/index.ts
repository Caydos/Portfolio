import { render } from "..";
import { Pass } from "../classes/pass";
import { Pipeline } from "../classes/pipeline";
import { renderData } from "../data";
import { VoxelPipeline } from "./voxel/class";
import { VoxelPassType } from "./voxel/passes/enum";
export let voxelPipeline: VoxelPipeline;

export async function initialize() {
    const { device, context } = renderData;

    voxelPipeline = new VoxelPipeline(device!, 1920, 1080);
    const res = await fetch('dist/shaders/voxel/main.wgsl');
    const code = await res.text();
    voxelPipeline.addPass(VoxelPassType.MAIN, code, code);

    // Allocate 2 mat4 = 2 * 64 = 128 bytes
    voxelPipeline.uniformBuffer = voxelPipeline.device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroupLayout = voxelPipeline.getPass(0)!.getPipeline().getBindGroupLayout(0);

    voxelPipeline.bindGroup = voxelPipeline.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: voxelPipeline.uniformBuffer,
                },
            },
        ],
    });
}

export function tick(delta: number) {
    const { device, context } = renderData;
    renderData.camera?.update(delta);
    const commandEncoder = device!.createCommandEncoder();
    const textureView = context!.getCurrentTexture().createView();
    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        }],
        depthStencilAttachment: {
            view: voxelPipeline.getDepthTextureView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        },
    });

    voxelPipeline.tick(delta, passEncoder);


    passEncoder.end();
    device!.queue.submit([commandEncoder.finish()]);
}