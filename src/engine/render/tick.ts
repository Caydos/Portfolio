import { defineQuery } from 'bitecs';
import { Transform } from '../../game/components/transform';
import { renderData } from './data';
import { world } from '../../game/world';
import * as pipelines from "./pipelines/index"

export function tick(delta: number) {
  // console.log(`Rendering frame with dt: ${delta}`);
  const { device, context } = renderData;
  if (!device || !context) return;

  pipelines.tick(delta);
}
