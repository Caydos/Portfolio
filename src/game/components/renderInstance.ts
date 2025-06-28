import { defineComponent, Types } from 'bitecs';

export const Renderable = defineComponent({
  meshId: Types.ui16,
  materialId: Types.ui8,
});