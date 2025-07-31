struct GlobalUniforms {
    viewProjMatrix: mat4x4<f32>,
};

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> global : GlobalUniforms;
@group(1) @binding(0) var<uniform> object : ObjectUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>,
};

@vertex
fn vs_main(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    var output: VertexOutput;
    var offset = vec3<f32>(.0, .0, .0);
    if instanceIndex > 0 {
        let finalIndex = i32(instanceIndex) - 1;
        let directionIndex: i32 = finalIndex % 8;
        let timesUsed = finalIndex / 8 + 1;

        offset.x = select(12.0, -12.0, (directionIndex & 4) != 0);
        offset.y = select(12.0, -12.0, (directionIndex & 2) != 0);
        offset.z = select(12.0, -12.0, (directionIndex & 1) != 0);

        offset *= f32(timesUsed);
    }

    let worldPosition = (object.modelMatrix * vec4<f32>(position, 1.0)).xyz + offset;

    output.position = global.viewProjMatrix * vec4<f32>(worldPosition, 1.0);
    output.worldPos = worldPosition;
    output.localPos = position;

    return output;
}


@fragment
fn fs_main(
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>
) -> @location(0) vec4<f32> {
  // Parameters
    let edgeWidth: f32 = 0.02;
    let glowFalloff: f32 = 0.01;

  // Absolute local position in cube [-0.5, 0.5]
    let aPos = abs(localPos);

  // Distance to each face edge (how close to edge)
    let dx = 0.4 - aPos.x;
    let dy = 0.4 - aPos.y;
    let dz = 0.4 - aPos.z;

  // Glow if close to edge (i.e., close to two axes)
  // Create soft edge glow
    let gx = smoothstep(edgeWidth + glowFalloff, glowFalloff, dx);
    let gy = smoothstep(edgeWidth + glowFalloff, glowFalloff, dy);
    let gz = smoothstep(edgeWidth + glowFalloff, glowFalloff, dz);

  // Combine to find pixels near edges (not just faces)
    let edgeGlow = gx * gy + gx * gz + gy * gz;

  // Base black cube
    let baseColor = vec3<f32>(0.0, 0.0, 0.0);

  // Glowing neon blue edges
    let edgeColor = vec3<f32>(0.1, 0.9, 1.0); // Tron blue

    let finalColor = mix(baseColor, edgeColor, edgeGlow);

    return vec4<f32>(finalColor, 1.0);
}