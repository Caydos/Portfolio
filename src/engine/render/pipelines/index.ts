import { render } from "..";
import { Pass } from "../classes/pass";
import { Pipeline } from "../classes/pipeline";
import { renderData } from "../data";
import { VoxelPassType } from "./voxel/passes/enum";
export let voxelPipeline: Pipeline;

export async function initialize() {
    const { device, context } = renderData;
    const res = await fetch('dist/shaders/shader.wgsl');
    const code = await res.text();
    voxelPipeline = new Pipeline(device!, 1920, 1080);
    voxelPipeline.addPass(VoxelPassType.MAIN, code, code);
}

export function tick(delta: number) {
 voxelPipeline.tick(delta);
}