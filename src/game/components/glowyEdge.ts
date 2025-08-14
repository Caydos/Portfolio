import { defineComponent, Types } from 'bitecs';
export enum GlowyEdgeMask {
  // Edges parallel to Z (pick by signs of X,Y)
  Z_PosX_PosY = 1 << 0,
  Z_PosX_NegY = 1 << 1,
  Z_NegX_PosY = 1 << 2,
  Z_NegX_NegY = 1 << 3,

  // Edges parallel to Y (pick by signs of X,Z)
  Y_PosX_PosZ = 1 << 4,
  Y_PosX_NegZ = 1 << 5,
  Y_NegX_PosZ = 1 << 6,
  Y_NegX_NegZ = 1 << 7,

  // Edges parallel to X (pick by signs of Y,Z)
  X_PosY_PosZ = 1 << 8,
  X_PosY_NegZ = 1 << 9,
  X_NegY_PosZ = 1 << 10,
  X_NegY_NegZ = 1 << 11,
}

export const GlowyEdge = defineComponent({
  mask: Types.ui32,
});
