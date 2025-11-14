import { Pass } from './pass';
/**
 * @brief Custom Pipeline class implementation to fit the architecture.
 * @warning persistent over one device, the one used in the ctor.
 */
export class Pipeline {
    private depthTexture: GPUTexture;
    private depthTextureView: GPUTextureView;

    private colorTexture: GPUTexture;
    private colorTextureView: GPUTextureView;

    private passes: Map<number, Pass> = new Map();

    constructor(public device: GPUDevice, canvas: HTMLCanvasElement) {
        const width = canvas.width;
        const height = canvas.height;

        this.depthTexture = this.createDepthTexture(width, height);
        this.depthTextureView = this.depthTexture.createView();

        this.colorTexture = this.createColorTexture(width, height);
        this.colorTextureView = this.colorTexture.createView();
    }


    private createDepthTexture(width: number, height: number): GPUTexture {
        return this.device.createTexture({
            size: { width, height },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
    }

    private createColorTexture(width: number, height: number): GPUTexture {
        return this.device.createTexture({
            size: { width, height },
            format: 'bgra8unorm', // or rgba16float if you want HDR bloom
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT | // we draw into it
                GPUTextureUsage.TEXTURE_BINDING,     // we sample from it later
        });
    }

    public getDepthTextureView(): GPUTextureView {
        return this.depthTextureView;
    }
    public getColorTextureView(): GPUTextureView {
        return this.colorTextureView;
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
