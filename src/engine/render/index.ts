import { init } from "./init";
import { tick } from "./tick";
import { renderState } from "./state";

export const render = {
     init,
     tick,
     get device() {
          return renderState.device!;
     },
     get context() {
          return renderState.context!;
     },
     get format() {
          return renderState.format!;
     },
};
