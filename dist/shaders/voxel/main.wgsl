struct GlobalUniforms {
    viewProjMatrix: mat4x4<f32>,// 64 bytes
    cameraWorldPos: vec3<f32>,// 16 bytes
    time: f32,// 4 bytes
};// aligned on 96 bytes

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,// 64 bytes
    edgeMask: u32,// 4 bytes
};// aligned on 80 bytes

override DRAW_SINGLE: bool = false;

@group(0) @binding(0)
var<uniform> global: GlobalUniforms;
@group(1) @binding(0)
var<uniform> object: ObjectUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>,
}

;

fn get_offset_from_direction(dir: i32, step: f32) -> vec3<f32> {
    let dx = select(step, - step, (dir & 4) != 0);
    let dy = select(step, - step, (dir & 2) != 0);
    let dz = select(step, - step, (dir & 1) != 0);
    return vec3<f32>(dx, dy, dz);
}

@vertex
fn vs_main(@location(0) position: vec3<f32>, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
    var output: VertexOutput;

    let stepSize: f32 = 12.0;

    let camGridF: vec3<f32> = floor(global.cameraWorldPos / stepSize + vec3<f32>(0.5));
    let camGridI: vec3<i32> = vec3<i32>(i32(camGridF.x), i32(camGridF.y), i32(camGridF.z));

    let camFrac: vec3<f32> = global.cameraWorldPos - vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;

    var offsetSum: vec3<f32> = vec3<f32>(0.0);
    var n: i32 = i32(instanceIndex);
    var level: i32 = 0;
    if (!DRAW_SINGLE)
    {
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
    }

    let camShift: vec3<f32> = vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;
    offsetSum = offsetSum + camShift;

    let offset = select(offsetSum - camFrac, vec3<f32>(0.0), DRAW_SINGLE);

    let worldPosition = (object.modelMatrix * vec4<f32>(position, 1.0)).xyz + offset;

    output.position = global.viewProjMatrix * vec4<f32>(worldPosition, 1.0);
    output.worldPos = worldPosition;
    output.localPos = position;
    return output;
}

fn bool2float(b: bool) -> f32 {
    return select(0.0, 1.0, b);
}

fn select_quadrant(a: f32, b: f32, bitPP: u32, bitPN: u32, bitNP: u32, bitNN: u32, mask: u32) -> f32 {
    let posA = bool2float(a >= 0.0);
    let negA = 1.0 - posA;
    let posB = bool2float(b >= 0.0);
    let negB = 1.0 - posB;

    let mPP = bool2float((mask & bitPP) != 0u);
    let mPN = bool2float((mask & bitPN) != 0u);
    let mNP = bool2float((mask & bitNP) != 0u);
    let mNN = bool2float((mask & bitNN) != 0u);

    return posA * posB * mPP + posA * negB * mPN + negA * posB * mNP + negA * negB * mNN;
}

fn edge_weights(aPos: vec3<f32>, radius: f32, width: f32, falloff: f32) -> vec3<f32> {
    let d = vec3<f32>(radius) - aPos;
    let g = smoothstep(vec3<f32>(width + falloff), vec3<f32>(falloff), d);
    let wZ = g.x * g.y; // || Z
    let wY = g.x * g.z; // || Y
    let wX = g.y * g.z; // || X
    return vec3<f32>(wX, wY, wZ);
}
fn camera_light_factor(worldPos: vec3<f32>) -> f32 {
    // Distance from camera
    let dist = distance(worldPos, global.cameraWorldPos);

    // Range settings – tweak to taste
    let innerRadius: f32 = 4.0;   // bright up close
    let outerRadius: f32 = 40.0;  // fades to ambient

    let t = clamp((dist - innerRadius) / (outerRadius - innerRadius), 0.0, 1.0);
    let camIntensity = 1.0 - t;

    // Dark ambient so far stuff is mostly black
    let ambient: f32 = 0.05;

    // Between ambient and full light
    return ambient + camIntensity * (1.0 - ambient);
}
@fragment
fn fs_main(
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>
) -> @location(0) vec4<f32> {
    let edgeWidth: f32   = 0.02;
    let glowFalloff: f32 = 0.01;

    let baseColor     = vec3<f32>(0.8, 0.8, 0.8);
    let edgeColor     = vec3<f32>(0.0, 0.0, 0.0);
    let edgeGlowColor = vec3<f32>(0.78, 0.83, 0.06);

    let aPos = abs(localPos);

    let wGlow  = edge_weights(aPos, 0.4, edgeWidth, glowFalloff); // glowy edges
    let wNorm  = edge_weights(aPos, 0.5, edgeWidth, glowFalloff); // normal edges

    // Bitmask: Z:0..3, Y:4..7, X:8..11
    let mask = object.edgeMask;
    let selZ = select_quadrant(localPos.x, localPos.y, 1u<<0, 1u<<1, 1u<<2, 1u<<3, mask);
    let selY = select_quadrant(localPos.x, localPos.z, 1u<<4, 1u<<5, 1u<<6, 1u<<7, mask);
    let selX = select_quadrant(localPos.y, localPos.z, 1u<<8, 1u<<9, 1u<<10, 1u<<11, mask);

    let sel        = vec3<f32>(selX, selY, selZ);
    let edgeGlow   = dot(wGlow, sel);
    let normalEdge = dot(wNorm, vec3<f32>(1.0));

    // ------- ORIGINAL COLOR (unchanged) -------
    var finalColor: vec3<f32>;
    if (edgeGlow > 0.0) {
        finalColor = mix(baseColor, edgeGlowColor, edgeGlow);
    } else {
        finalColor = mix(baseColor, edgeColor, normalEdge);
    }

    // ------- lighting & emission is added *after* this -------

    // 1) Treat this as the base surface color
    let baseSurface = finalColor;

    // 2) Camera “flashlight” lighting
    let camLight = camera_light_factor(worldPos);
    var litSurface = baseSurface * camLight;

    // 3) Local light around glowing edges (soft halo, not extra geometry)
    //    Uses a slightly wider band but only affects brightness, not color mix.
    let wInfluence = edge_weights(aPos, 0.45, edgeWidth * 2.5, glowFalloff * 0.5);
    let edgeInfluence = dot(wInfluence, sel);   // 0..1

    let edgeLightStrength: f32 = 0.7;           // how much edges light nearby tiles
    let edgeLightFactor = 1.0 + edgeInfluence * edgeLightStrength;
    litSurface *= edgeLightFactor;

    // 4) Emissive term so edges stay visible in the dark
    let emissiveStrength: f32 = 2.0;
    let emissive = edgeGlowColor * edgeGlow * emissiveStrength;

    let finalLitColor = litSurface + emissive;

    return vec4<f32>(finalLitColor, 1.0);
}
