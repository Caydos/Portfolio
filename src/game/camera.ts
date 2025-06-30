import { mat4, vec3 } from 'gl-matrix';
import { renderData } from '../engine/render/data'; // adjust path as needed
import { render } from '../engine/render';

export class Camera {
  public viewProjMatrix = mat4.create();

  public position = vec3.fromValues(5, 5, 5);
  private yaw = 0;
  private pitch = 0;

  public up = vec3.fromValues(0, 1, 0);

  public fov: number;
  public aspect: number;
  public near = 1.0;
  public far = 100;

  private speed = 5; // units per second
  private sensitivity = 0.002;

  // Input state
  private keysPressed = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(fov: number, aspect: number) {
    this.fov = fov;
    this.aspect = aspect;

    this.initInputListeners();
  }

  private initInputListeners() {
    const { canvas } = renderData;
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });

    canvas!.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas!.requestPointerLock?.();
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
      document.exitPointerLock?.();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;

      const deltaX = e.movementX ?? (e.clientX - this.lastX);
      const deltaY = e.movementY ?? (e.clientY - this.lastY);

      this.rotate(-deltaX * this.sensitivity, -deltaY * this.sensitivity);

      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
  }

  public update(deltaTime: number) {
    this.aspect = renderData.canvas!.width / renderData.canvas!.height;
    const velocity = this.speed * deltaTime;

    // Calculate direction vector from yaw and pitch (for both view and movement)
    const forward = vec3.fromValues(
      Math.cos(this.pitch) * Math.sin(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.cos(this.yaw)
    );
    vec3.normalize(forward, forward);

    // Right vector (still horizontal, no pitch)
    const right = vec3.fromValues(
      Math.sin(this.yaw - Math.PI / 2),
      0,
      Math.cos(this.yaw - Math.PI / 2)
    );
    vec3.normalize(right, right);

    // WASD movement
    if (this.keysPressed.has('w')) {
      vec3.scaleAndAdd(this.position, this.position, forward, velocity);
    }
    if (this.keysPressed.has('s')) {
      vec3.scaleAndAdd(this.position, this.position, forward, -velocity);
    }
    if (this.keysPressed.has('d')) {
      vec3.scaleAndAdd(this.position, this.position, right, velocity);
    }
    if (this.keysPressed.has('a')) {
      vec3.scaleAndAdd(this.position, this.position, right, -velocity);
    }

    // Calculate the target point (what the camera is looking at)
    const target = vec3.create();
    vec3.add(target, this.position, forward);

    // View matrix
    const view = mat4.lookAt(mat4.create(), this.position, target, this.up);

    // Projection matrix
    const proj = mat4.perspective(
      mat4.create(),
      (this.fov * Math.PI) / 180,
      this.aspect,
      this.near,
      this.far
    );

    // Final view-projection matrix
    mat4.multiply(this.viewProjMatrix, proj, view);
  }

  private rotate(yawOffset: number, pitchOffset: number) {
    this.yaw += yawOffset;
    this.pitch += pitchOffset;

    // Clamp pitch to avoid flipping camera upside down
    const maxPitch = Math.PI / 2 * 0.99;
    this.pitch = Math.min(maxPitch, Math.max(-maxPitch, this.pitch));
  }
}
