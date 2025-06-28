import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({
  positionX: Types.f32,
  positionY: Types.f32,
  positionZ: Types.f32,
  rotationY: Types.f32,
  scale: Types.f32,
});
