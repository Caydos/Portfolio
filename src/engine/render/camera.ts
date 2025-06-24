import { mat4, vec3 } from 'gl-matrix';

export class Camera {
  position: vec3 = vec3.fromValues(0, 0, -5);
  yaw = 0;
  pitch = 0;
  speed = 0.05;

  getViewMatrix(): mat4 {
    const front = vec3.fromValues(
      Math.cos(this.pitch) * Math.sin(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.cos(this.yaw)
    );

    const target = vec3.create();
    vec3.add(target, this.position, front);
    const up = vec3.fromValues(0, 1, 0);
    const view = mat4.create();
    mat4.lookAt(view, this.position, target, up);
    return view;
  }

  moveForward() {
    const dir = vec3.fromValues(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    vec3.scaleAndAdd(this.position, this.position, dir, this.speed);
  }

  moveBackward() {
    const dir = vec3.fromValues(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    vec3.scaleAndAdd(this.position, this.position, dir, -this.speed);
  }

  moveRight() {
    const right = vec3.fromValues(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    vec3.scaleAndAdd(this.position, this.position, right, -this.speed);
  }

  moveLeft() {
    const right = vec3.fromValues(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    vec3.scaleAndAdd(this.position, this.position, right, this.speed);
  }

  lookLeft() {
    this.yaw += 0.02;
  }

  lookRight() {
    this.yaw -= 0.02;
  }

  lookUp() {
    this.pitch = Math.min(this.pitch + 0.02, Math.PI / 2 - 0.01);
  }

  lookDown() {
    this.pitch = Math.max(this.pitch - 0.02, -Math.PI / 2 + 0.01);
  }
}
