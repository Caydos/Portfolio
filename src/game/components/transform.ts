import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
  scale: Types.f32,
});
