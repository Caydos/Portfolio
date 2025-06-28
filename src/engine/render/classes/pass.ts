
/**
 * @brief Abstraction for default webgpu RenderPipeline
 */
export class Pass {
    private pipeline: GPURenderPipeline;

    constructor(
        device: GPUDevice,
        vertexShader: string,
        fragmentShader: string
    ) {
        this.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({ code: vertexShader }),
                entryPoint: 'vs_main',
            },
            fragment: {
                module: device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: 'bgra8unorm',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });
    }
    public getPipeline(): GPURenderPipeline {
        return this.pipeline;
    }
}
