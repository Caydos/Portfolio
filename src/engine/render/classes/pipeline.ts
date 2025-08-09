import { Pass } from './pass';
/**
 * @brief Custom Pipeline class implementation to fit the architecture.
 * @warning persistent over one device, the one used in the ctor.
 */
export class Pipeline {
    private depthTexture: GPUTexture;
    private depthTextureView: GPUTextureView;
    private passes: Map<number, Pass> = new Map();

    constructor(public device: GPUDevice, canvas: HTMLCanvasElement) {
        const width = canvas.width;
        const height = canvas.height;
        this.depthTexture = this.createDepthTexture(width, height);
        this.depthTextureView = this.depthTexture.createView();
    }


    private createDepthTexture(width: number, height: number): GPUTexture {
        return this.device.createTexture({
            size: { width, height },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
    }



    public getDepthTextureView(): GPUTextureView {
        return this.depthTextureView;
    }
    public addPass(id: number, vertexShader: string, fragmentShader: string): void {
        const pass = new Pass(this.device, vertexShader, fragmentShader);
        this.passes.set(id, pass);
    }
    public getPass(id: number): Pass | undefined {
        return this.passes.get(id);
    }
    public tick(delta: number, passEncoder: GPURenderPassEncoder) { }
}
