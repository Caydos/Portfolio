import { render } from "./engine/render";

async function main() {
     await render.init();
     requestAnimationFrame(loop);
}
let lastTime = 0;
function loop(time: DOMHighResTimeStamp) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;

  render.tick(delta);
  
  const fps = 1 / delta;
  document.title = `FPS: ${fps.toFixed(1)}`;
  requestAnimationFrame(loop);
}

main();
