import { addEntity, addComponent } from 'bitecs';
import { Renderable } from '../components/renderInstance';
import { Transform } from '../components/transform';
import { world } from '.';

export function generate() {
    for (let i = 0; i < 100; i++) {
        const eid = addEntity(world);

        addComponent(world, Transform, eid);
        Transform.positionX[eid] = Math.random() * 10;
        Transform.positionY[eid] = 0;
        Transform.positionZ[eid] = Math.random() * 10;
        Transform.rotationY[eid] = Math.random() * Math.PI;
        Transform.scale[eid] = 1;

        addComponent(world, Renderable, eid);
        Renderable.meshId[eid] = 0;
        Renderable.materialId[eid] = 0;
    }
}
