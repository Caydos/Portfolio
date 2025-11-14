import { Pipeline } from "../../classes/pipeline";
import { renderData } from "../../data";


export class PostPipeline extends Pipeline {
    private bindGroupLayout: GPUBindGroupLayout | null = null;
    private sourceView: GPUTextureView | null = null;
    private sampler: GPUSampler;

    constructor(device: GPUDevice, width: number, height: number) {
        super(device, renderData.canvas!);
        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });
    }

    public override tick(delta: number, passEncoder: GPURenderPassEncoder) {
        const { device, meshManager, camera } = renderData;
        const pipeline = this.getPass(0)?.getPipeline();

        if (!this.sourceView) return;
        this.bindGroupLayout = pipeline!.getBindGroupLayout(0);

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.sourceView },
            ],
        });

        passEncoder.setPipeline(pipeline!);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(3, 1, 0, 0); // fullscreen triangle
    }
}
