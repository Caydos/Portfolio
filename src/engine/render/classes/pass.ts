
/**
 * @brief Abstraction for default webgpu RenderPipeline
 */
export class Pass {
    private pipeline: GPURenderPipeline;

    constructor(
        device: GPUDevice,
        vertexShader: string,
        fragmentShader: string,
    ) {
        this.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({ code: vertexShader }),
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 3 * 4, // 3 floats * 4 bytes = 12 bytes per vertex
                        attributes: [
                            {
                                shaderLocation: 0, // matches @location(0)
                                offset: 0,
                                format: 'float32x3', // vec3<f32>
                            },
                        ],
                    },
                ],
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
