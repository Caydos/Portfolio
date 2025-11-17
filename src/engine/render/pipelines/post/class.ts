// src/engine/render/pipelines/post/class.ts
import { Pipeline } from "../../classes/pipeline";
import { renderData } from "../../data";

export class PostPipeline extends Pipeline {
    private pipeline: GPURenderPipeline;
    private sampler: GPUSampler;
    private bindGroupLayout: GPUBindGroupLayout;
    private sourceView: GPUTextureView | null = null;

    constructor(device: GPUDevice, shaderCode: string) {
        super(device, renderData.canvas!);

        const module = device.createShaderModule({ code: shaderCode });

        this.pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_main",
                buffers: [],
            },
            fragment: {
                module,
                entryPoint: "fs_main",
                targets: [
                    {
                        format: renderData.format!, // ← MUST match canvas format
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "none",
            },
        });

        this.bindGroupLayout = this.pipeline.getBindGroupLayout(0);

        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });
    }

    public setSourceTextureView(view: GPUTextureView) {
        this.sourceView = view;
    }

    public override tick(delta: number, passEncoder: GPURenderPassEncoder) {
        if (!this.sourceView) return;

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.sourceView },
            ],
        });

        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(3, 1, 0, 0);
    }
}
