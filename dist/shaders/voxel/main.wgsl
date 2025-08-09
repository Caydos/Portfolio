struct GlobalUniforms {
    viewProjMatrix: mat4x4<f32>, // 64 bytes
    cameraWorldPos: vec3<f32>, // 16 bytes
    time: f32, // 4 bytes
};// aligned on 96 bytes

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>, // 64 bytes
    edgeMask: u32,            // 4 bytes
};// aligned on 80 bytes

@group(0) @binding(0) var<uniform> global : GlobalUniforms;
@group(1) @binding(0) var<uniform> object : ObjectUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>,
};

fn get_offset_from_direction(dir: i32, step: f32) -> vec3<f32> {
    let dx = select(step, -step, (dir & 4) != 0);
    let dy = select(step, -step, (dir & 2) != 0);
    let dz = select(step, -step, (dir & 1) != 0);
    return vec3<f32>(dx, dy, dz);
}

@vertex
fn vs_main(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    var output: VertexOutput;

    let stepSize: f32 = 12.0;

    let camGridF: vec3<f32> = floor(global.cameraWorldPos / stepSize + vec3<f32>(0.5));
    let camGridI: vec3<i32> = vec3<i32>(i32(camGridF.x), i32(camGridF.y), i32(camGridF.z));

    let camFrac: vec3<f32> = global.cameraWorldPos - vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;

    var offsetSum: vec3<f32> = vec3<f32>(0.0);
    var n: i32 = i32(instanceIndex);
    var level: i32 = 0;
    loop {
        if (n == 0) {
            break;
        }
        n = n - 1;
        let digit: i32 = n % 8;
        offsetSum = offsetSum + get_offset_from_direction(digit, stepSize);
        n = n / 8;
        level = level + 1;
        // safety cap
        if (level >= 8) {
            break;
        }
    }

    let camShift: vec3<f32> = vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;
    offsetSum = offsetSum + camShift;

    let offset: vec3<f32> = offsetSum - camFrac;

    let worldPosition: vec3<f32> = (object.modelMatrix * vec4<f32>(position, 1.0)).xyz + offset;

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
    let edgeWidth: f32 = 0.02;
    let glowFalloff: f32 = 0.01;

    let aPos = abs(localPos);

    let dx = 0.4 - aPos.x;
    let dy = 0.4 - aPos.y;
    let dz = 0.4 - aPos.z;

    let gx = smoothstep(edgeWidth + glowFalloff, glowFalloff, dx);
    let gy = smoothstep(edgeWidth + glowFalloff, glowFalloff, dy);
    let gz = smoothstep(edgeWidth + glowFalloff, glowFalloff, dz);

    let edgeGlowX = gx * gy; // edges parallel to Z
    let edgeGlowY = gx * gz; // edges parallel to Y
    let edgeGlowZ = gy * gz; // edges parallel to X

    let mask = object.edgeMask;
    // let glowMaskX = f32((mask & 1u) != 0u);
    // let glowMaskY = f32((mask & 2u) != 0u);
    // let glowMaskZ = f32((mask & 4u) != 0u);

    // let edgeGlow = edgeGlowX * glowMaskX +
    //                edgeGlowY * glowMaskY +
    //                edgeGlowZ * glowMaskZ;

    let edgeGlow = edgeGlowX * 1.0 +
                   edgeGlowY * 1.0 +
                   edgeGlowZ * 1.0;

    let baseColor = vec3<f32>(0.0, 0.0, 0.0);
    let edgeColor = vec3<f32>(0.1, 0.9, 1.0);

    let finalColor = mix(baseColor, edgeColor, edgeGlow);

    return vec4<f32>(finalColor, 1.0);
}