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
          const w = renderData.canvas!.width | 0;
          const h = renderData.canvas!.height | 0;
          voxelPipeline = new VoxelPipeline(device!, w, h);
          const res = await fetch("dist/shaders/voxel/voxel.wgsl");
          const code = await res.text();
          voxelPipeline.addPass(VoxelPassType.MAIN, code, code, "rgba16float");

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
          const postRes = await fetch("dist/shaders/post/post.wgsl");
          const postCode = await postRes.text();
          postPipeline = new PostPipeline(device!, postCode);
          // postPipeline.addPass(PostPassType.MAIN, code, code);
     }
}

export function tick(delta: number) {
  const { device, context } = renderData;
  renderData.camera?.update(delta);
  if (!device || !context) return;

  const commandEncoder = device.createCommandEncoder();

  // PASS 1: scene -> HDR offscreen
  const sceneColorView = voxelPipeline.getColorTextureView();
  const scenePass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: sceneColorView,
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    }],
    depthStencilAttachment: {
      view: voxelPipeline.getDepthTextureView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  voxelPipeline.tick(delta, scenePass);
  scenePass.end();

  // PASS 2+: bloom + composite -> swapchain
  const swapView = context.getCurrentTexture().createView();
  postPipeline.encode(commandEncoder, sceneColorView, swapView);

  device.queue.submit([commandEncoder.finish()]);
}
