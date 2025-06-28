import { createWorld, IWorld } from "bitecs";
import * as tesseract from "./tesseract";

export let world: IWorld;

export function initializeWorld()
{
    world = createWorld();
    tesseract.generate();
}