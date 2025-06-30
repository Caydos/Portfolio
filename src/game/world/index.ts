import { addComponent, addEntity, createWorld, IWorld } from "bitecs";
import * as tesseract from "./tesseract";
import { Renderable } from "../components/renderInstance";
import { Transform } from "../components/transform";

export let world: IWorld;
export function spawnCubes(meshId: number, gridSize = 5, spacing = 2) {
  console.log(`[render/init.ts::spawnCubes] - meshId : ${meshId}`);
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const eid = addEntity(world);

      addComponent(world, Transform, eid);
      Transform.x[eid] = (x - gridSize / 2) * spacing;
      Transform.y[eid] = 0;
      Transform.z[eid] = (z - gridSize / 2) * spacing;


      addComponent(world, Renderable, eid);
      Renderable.meshId[eid] = meshId;
    }
  }
}
export function initializeWorld(meshId: number) {
  world = createWorld();
  // tesseract.generate();
  spawnCubes(meshId);//! HARDCODED mesh ID
}