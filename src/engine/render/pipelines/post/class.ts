// src/engine/render/pipelines/post/class.ts
import { Pipeline } from "../../classes/pipeline";
import { renderData } from "../../data";


export class PostPipeline {
    private device: GPUDevice;

    private sampler: GPUSampler;

    // Pipelines
    private extractPipeline: GPURenderPipeline;
    private blurPipeline: GPURenderPipeline;
    private compositePipeline: GPURenderPipeline;

    // Bloom textures (ping-pong)
    private bloomA: GPUTexture;
    private bloomAView: GPUTextureView;
    private bloomB: GPUTexture;
    private bloomBView: GPUTextureView;

    private bloomW: number;
    private bloomH: number;

    // Uniforms for blur/composite params
    private paramsBuffer: GPUBuffer;

    // Bind group layouts
    private extractBGL: GPUBindGroupLayout;
    private blurBGL: GPUBindGroupLayout;
    // private compositeBGL: GPUBindGroupLayout;

    private compositeBGL0: GPUBindGroupLayout;
    private compositeBGL1: GPUBindGroupLayout;
    private bgl: GPUBindGroupLayout;


    constructor(device: GPUDevice, shaderCode: string) {
        this.device = device;

        const canvas = renderData.canvas!;
        const w = canvas.width;
        const h = canvas.height;

        // half-res bloom
        this.bloomW = Math.max(1, Math.floor(w / 2));
        this.bloomH = Math.max(1, Math.floor(h / 2));

        const module = device.createShaderModule({ code: shaderCode });

        // Sampler: prefer linear if available
        // If float16 linear isn't supported on your adapter, switch to "nearest"
        this.sampler = device.createSampler({
            magFilter: "nearest",
            minFilter: "nearest",
        });

        // Shared uniform buffer
        // BlurParams:
        // texelSize(2) + dir(2) + threshold + bloomStrength + exposure + pad = 8 floats = 32 bytes
        this.paramsBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Extract pipeline (writes bloom half-res, reads scene HDR)
        this.extractPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: { module, entryPoint: "vs_main" },
            fragment: {
                module,
                entryPoint: "fs_extract",
                targets: [{ format: "rgba16float" }],
            },
            primitive: { topology: "triangle-list", cullMode: "none" },
        });

        // Blur pipeline (writes bloom half-res, reads bloom half-res)
        this.blurPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: { module, entryPoint: "vs_main" },
            fragment: {
                module,
                entryPoint: "fs_blur",
                targets: [{ format: "rgba16float" }],
            },
            primitive: { topology: "triangle-list", cullMode: "none" },
        });

        // Composite pipeline (writes swapchain, reads scene HDR + bloom)
        this.compositePipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: { module, entryPoint: "vs_main" },
            fragment: {
                module,
                entryPoint: "fs_composite",
                targets: [{ format: renderData.format! }],
            },
            primitive: { topology: "triangle-list", cullMode: "none" },
        });

        this.extractBGL = this.extractPipeline.getBindGroupLayout(0);
        this.blurBGL = this.blurPipeline.getBindGroupLayout(0);
        this.compositeBGL0 = this.compositePipeline.getBindGroupLayout(0);
        this.compositeBGL1 = this.compositePipeline.getBindGroupLayout(1);


        // Create bloom ping-pong textures
        this.bloomA = device.createTexture({
            size: { width: this.bloomW, height: this.bloomH },
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.bloomAView = this.bloomA.createView();

        this.bloomB = device.createTexture({
            size: { width: this.bloomW, height: this.bloomH },
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.bloomBView = this.bloomB.createView();
        this.bgl = this.compositePipeline.getBindGroupLayout(0);
    }
    private makeBindGroup(sceneHDRView: GPUTextureView, bloomInView: GPUTextureView): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.bgl,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: sceneHDRView },
                { binding: 2, resource: bloomInView },
                { binding: 3, resource: { buffer: this.paramsBuffer } },
            ],
        });
    }

    public encode(
        commandEncoder: GPUCommandEncoder,
        sceneHDRView: GPUTextureView,
        swapView: GPUTextureView
    ) {
        const texelSizeX = 1.0 / this.bloomW;
        const texelSizeY = 1.0 / this.bloomH;

        const makeBG = (layout: GPUBindGroupLayout, bloomInView: GPUTextureView) =>
            this.device.createBindGroup({
                layout,
                entries: [
                    { binding: 0, resource: this.sampler },
                    { binding: 1, resource: sceneHDRView },
                    { binding: 2, resource: bloomInView },
                    { binding: 3, resource: { buffer: this.paramsBuffer } },
                ],
            });

        // Get layouts from the specific pipelines (pipeline-specific objects!)
        const extractLayout = this.extractPipeline.getBindGroupLayout(0);
        const blurLayout = this.blurPipeline.getBindGroupLayout(0);
        const compositeLayout = this.compositePipeline.getBindGroupLayout(0);

        // ---- PASS A: extract bright -> bloomA ----
        this.writeParams({
            texelSizeX,
            texelSizeY,
            dirX: 0,
            dirY: 0,
            threshold: 1.0,
            bloomStrength: 0.9,
            exposure: 1.0,
        });

        {
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.bloomAView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            });

            pass.setPipeline(this.extractPipeline);
            // binding2 must exist per layout (we enforced with dummy reads)
            pass.setBindGroup(0, makeBG(extractLayout, this.bloomBView));
            pass.draw(3, 1, 0, 0);
            pass.end();
        }

        // ---- PASS B: blur horizontal bloomA -> bloomB ----
        this.writeParams({
            texelSizeX,
            texelSizeY,
            dirX: 1,
            dirY: 0,
            threshold: 1.0,
            bloomStrength: 0.9,
            exposure: 1.0,
        });

        {
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.bloomBView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            });

            pass.setPipeline(this.blurPipeline);
            pass.setBindGroup(0, makeBG(blurLayout, this.bloomAView)); // read bloomA
            pass.draw(3, 1, 0, 0);
            pass.end();
        }

        // ---- PASS C: blur vertical bloomB -> bloomA ----
        this.writeParams({
            texelSizeX,
            texelSizeY,
            dirX: 0,
            dirY: 1,
            threshold: 1.0,
            bloomStrength: 0.9,
            exposure: 1.0,
        });

        {
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.bloomAView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            });

            pass.setPipeline(this.blurPipeline);
            pass.setBindGroup(0, makeBG(blurLayout, this.bloomBView)); // read bloomB
            pass.draw(3, 1, 0, 0);
            pass.end();
        }

        // ---- PASS D: composite -> swapchain ----
        this.writeParams({
            texelSizeX,
            texelSizeY,
            dirX: 0,
            dirY: 0,
            threshold: 1.0,
            bloomStrength: 0.9,
            exposure: 1.15,
        });

        {
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: swapView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            });

            pass.setPipeline(this.compositePipeline);
            pass.setBindGroup(0, makeBG(compositeLayout, this.bloomAView)); // read final bloomA
            pass.draw(3, 1, 0, 0);
            pass.end();
        }
    }



    private writeParams(p: {
        texelSizeX: number; texelSizeY: number;
        dirX: number; dirY: number;
        threshold: number;
        bloomStrength: number;
        exposure: number;
    }) {
        const arr = new Float32Array(8);
        arr[0] = p.texelSizeX;
        arr[1] = p.texelSizeY;
        arr[2] = p.dirX;
        arr[3] = p.dirY;
        arr[4] = p.threshold;
        arr[5] = p.bloomStrength;
        arr[6] = p.exposure;
        arr[7] = 0;
        this.device.queue.writeBuffer(this.paramsBuffer, 0, arr.buffer);
    }
}