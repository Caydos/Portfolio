import { render } from "..";
import { Pass } from "../classes/pass";
import { Pipeline } from "../classes/pipeline";
import { renderData } from "../data";
import { PostPipeline } from "./post/class";
import { PostPassType } from "./post/passes/enum";
import { VoxelPipeline } from "./voxel/class";
import { VoxelPassType } from "./voxel/passes/enum";
export let voxelPipeline: VoxelPipeline;
export let postPipeline: PostPipeline;

export async function initialize() {
     const { device, context } = renderData;

     {
          voxelPipeline = new VoxelPipeline(device!, 1920, 1080);
          const res = await fetch("dist/shaders/voxel/main.wgsl");
          const code = await res.text();
          voxelPipeline.addPass(VoxelPassType.MAIN, code, code);

          voxelPipeline.globalUniformBuffer = device!.createBuffer({
               size: 96,
               usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });

          const bindGroupLayout = voxelPipeline
               .getPass(0)!
               .getPipeline()
               .getBindGroupLayout(0);

          voxelPipeline.bindGroup = voxelPipeline.device.createBindGroup({
               layout: bindGroupLayout,
               entries: [
                    {
                         binding: 0,
                         resource: {
                              buffer: voxelPipeline.globalUniformBuffer,
                         },
                    },
               ],
          });

          voxelPipeline.modelUniformBuffer = device!.createBuffer({
               size: 80, // 4x4 matrix
               usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });

          const modelBindGroupLayout = voxelPipeline
               .getPass(0)!
               .getPipeline()
               .getBindGroupLayout(1);

          voxelPipeline.modelBindGroup = device!.createBindGroup({
               layout: modelBindGroupLayout,
               entries: [
                    {
                         binding: 0,
                         resource: {
                              buffer: voxelPipeline.modelUniformBuffer,
                         },
                    },
               ],
          });
     }
     {
          postPipeline = new PostPipeline(device!, 1920, 1080);

          const res = await fetch("dist/shaders/post/main.wgsl");
          const code = await res.text();
          postPipeline.addPass(PostPassType.MAIN, code, code);
     }
}

export function tick(delta: number) {
     const { device, context } = renderData;
     renderData.camera?.update(delta);
     const commandEncoder = device!.createCommandEncoder();
     const textureView = context!.getCurrentTexture().createView();
     const sceneColorView = voxelPipeline.getColorTextureView();

     const scenePass = commandEncoder.beginRenderPass({
          colorAttachments: [
               {
                    view: sceneColorView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
               },
          ],
          depthStencilAttachment: {
               view: voxelPipeline.getDepthTextureView(),
               depthClearValue: 1.0,
               depthLoadOp: "clear",
               depthStoreOp: "store",
          },
     });

     voxelPipeline.tick(delta, scenePass);

     scenePass.end();



     const swapTextureView = context!.getCurrentTexture().createView();

     const postPass = commandEncoder.beginRenderPass({
          colorAttachments: [
               {
                    view: swapTextureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
               },
          ],
     });
     postPipeline.tick(delta, postPass);
     postPass.end();

     device!.queue.submit([commandEncoder.finish()]);
}
