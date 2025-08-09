import { init } from "./init";
import { tick } from "./tick";
import { renderData } from "./data";

export const render = {
     init,
     tick,
     get device() {
          return renderData.device!;
     },
     get context() {
          return renderData.context!;
     },
     get format() {
          return renderData.format!;
     },
};
