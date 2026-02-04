struct GlobalUniforms {
    viewProjMatrix: mat4x4<f32>,
    cameraWorldPos: vec3<f32>,
    time: f32,
};

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
    edgeMask: u32,
};

override DRAW_SINGLE: bool = false;

@group(0) @binding(0) var<uniform> global: GlobalUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) localPos: vec3<f32>,
    @location(2) stableWorldPos: vec3<f32>,
};
fn approxNormalFromLocal(localPos: vec3<f32>) -> vec3<f32> {
    let a = abs(localPos);
    if (a.x > a.y && a.x > a.z) {
        return vec3<f32>(sign(localPos.x), 0.0, 0.0);
    } else if (a.y > a.z) {
        return vec3<f32>(0.0, sign(localPos.y), 0.0);
    }
    return vec3<f32>(0.0, 0.0, sign(localPos.z));
}

fn fogFactorExp2(dist: f32) -> f32 {
    let density: f32 = 0.018; // 0.012–0.03
    let x = density * dist;
    let f = 1.0 - exp(-x * x);
    return clamp(f, 0.0, 1.0);
}

fn get_offset_from_direction(dir: i32, step: f32) -> vec3<f32> {
    let dx = select(step, -step, (dir & 4) != 0);
    let dy = select(step, -step, (dir & 2) != 0);
    let dz = select(step, -step, (dir & 1) != 0);
    return vec3<f32>(dx, dy, dz);
}

@vertex
fn vs_main(@location(0) position: vec3<f32>, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
    var output: VertexOutput;

    let stepSize: f32 = 12.0;

    let camGridF: vec3<f32> = floor(global.cameraWorldPos / stepSize + vec3<f32>(0.5));
    let camGridI: vec3<i32> = vec3<i32>(i32(camGridF.x), i32(camGridF.y), i32(camGridF.z));

    let camFrac: vec3<f32> =
        global.cameraWorldPos - vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;

    var offsetSum: vec3<f32> = vec3<f32>(0.0);
    var n: i32 = i32(instanceIndex);
    var level: i32 = 0;

    if (!DRAW_SINGLE) {
        loop {
            if (n == 0) { break; }
            n = n - 1;
            let digit: i32 = n % 8;
            offsetSum = offsetSum + get_offset_from_direction(digit, stepSize);
            n = n / 8;
            level = level + 1;
            if (level >= 8) { break; }
        }
    }

    let camShift: vec3<f32> = vec3<f32>(f32(camGridI.x), f32(camGridI.y), f32(camGridI.z)) * stepSize;
    offsetSum = offsetSum + camShift;

    let offset = select(offsetSum - camFrac, vec3<f32>(0.0), DRAW_SINGLE);

    let worldPosition = (object.modelMatrix * vec4<f32>(position, 1.0)).xyz + offset;

    output.position = global.viewProjMatrix * vec4<f32>(worldPosition, 1.0);
    output.worldPos = worldPosition;
    output.localPos = position;
    output.stableWorldPos = worldPosition + global.cameraWorldPos;

    return output;
}

fn bool2float(b: bool) -> f32 { return select(0.0, 1.0, b); }

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
    let wZ = g.x * g.y;
    let wY = g.x * g.z;
    let wX = g.y * g.z;
    return vec3<f32>(wX, wY, wZ);
}

fn fogFactor(dist: f32) -> f32 {
    let density: f32 = 0.03; // 0.02–0.06
    let f = 1.0 - exp(-density * dist);
    return clamp(f, 0.0, 1.0);
}

fn faceGrid(localPos: vec3<f32>) -> f32 {
    let p = (localPos + vec3<f32>(0.5)) * 14.0;

    let fx = abs(fract(p.x) - 0.5);
    let fy = abs(fract(p.y) - 0.5);
    let fz = abs(fract(p.z) - 0.5);

    let lineXY = 1.0 - smoothstep(0.47, 0.50, min(fx, fy));
    let lineXZ = 1.0 - smoothstep(0.47, 0.50, min(fx, fz));
    let lineYZ = 1.0 - smoothstep(0.47, 0.50, min(fy, fz));

    return max(max(lineXY, lineXZ), lineYZ) * 0.18;
}

fn hash31(p: vec3<f32>) -> f32 {
  let h = dot(p, vec3<f32>(127.1, 311.7, 74.7));
  return fract(sin(h) * 43758.5453123);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    hash31(p + vec3<f32>(1.0, 0.0, 0.0)),
    hash31(p + vec3<f32>(0.0, 1.0, 0.0)),
    hash31(p + vec3<f32>(0.0, 0.0, 1.0))
  );
}


fn hash(p: vec3<f32>) -> f32 {
  return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7))) * 43758.5453);
}

fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);

  let u = f * f * (3.0 - 2.0 * f);

  let n000 = hash(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = hash(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = hash(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = hash(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = hash(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = hash(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = hash(i + vec3<f32>(1.0, 1.0, 1.0));

  let nx00 = mix(n000, n100, u.x);
  let nx10 = mix(n010, n110, u.x);
  let nx01 = mix(n001, n101, u.x);
  let nx11 = mix(n011, n111, u.x);

  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);

  return mix(nxy0, nxy1, u.z);
}

fn fbm(p: vec3<f32>) -> f32 {
  var v: f32 = 0.0;
  var a: f32 = 0.5;
  var f: vec3<f32> = p;
  for (var i: i32 = 0; i < 5; i = i + 1) {
    v = v + a * noise3(f);
    f = f * 2.0;
    a = a * 0.5;
  }
  return v;
}
fn rotateY(p: vec3<f32>, a: f32) -> vec3<f32> {
  let s = sin(a);
  let c = cos(a);
  return vec3<f32>(
    c * p.x + s * p.z,
    p.y,
    -s * p.x + c * p.z
  );
}

fn hsv2rgb(hsv: vec3<f32>) -> vec3<f32> {
  let h = hsv.x;
  let s = hsv.y;
  let v = hsv.z;

  let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  let p = abs(fract(vec3<f32>(h, h, h) + K.xyz) * 6.0 - vec3<f32>(K.w, K.w, K.w));
  let a = clamp(p - vec3<f32>(K.x, K.x, K.x), vec3<f32>(0.0), vec3<f32>(1.0));
  return v * mix(vec3<f32>(K.x, K.x, K.x), a, s);
}

fn cosmicColor3D(p: vec3<f32>, t: f32) -> vec3<f32> {
  let tt = t;
  let pr = rotateY(p, tt * 0.0001) + vec3<f32>(0.0, tt * 0.18, 0.0);

  let w  = fbm(pr * 0.65 + vec3<f32>(0.0, tt * 0.04, 0.0));
  let q  = pr + w * 1.8;

  let n1 = fbm(q * 1.05 + vec3<f32>(0.0, tt * 0.05, 0.0));
  let n2 = fbm(q * 2.20 - vec3<f32>(tt * 0.03, 0.0, tt * 0.02));
  let d  = clamp(n1 * 0.85 + n2 * 0.55, 0.0, 1.0);

  let hueShift = 0.04 * sin(tt * 0.22 + dot(pr, vec3<f32>(0.015, 0.012, 0.010)));

  let base = hsv2rgb(vec3<f32>(0.62 + hueShift, 0.55, 0.05));  // deep blue
  let mid  = hsv2rgb(vec3<f32>(0.88 + hueShift, 0.75, 0.95));  // magenta nebula
  let hi   = hsv2rgb(vec3<f32>(0.55 + hueShift, 0.65, 1.15));  // teal/cyan highlight (HDR)

  var col = mix(base, mid, smoothstep(0.20, 0.75, d));
  col = mix(col, hi, d * d);

  let sparkle = pow(clamp(n2, 0.0, 1.0), 9.0) * 0.75;
  col += vec3<f32>(1.0, 0.95, 0.80) * sparkle;

  col *= 0.28;
  return col;
}

fn hash_u32(x: u32) -> u32 {
  var v = x;
  v ^= (v >> 16u);
  v *= 0x7feb352du;
  v ^= (v >> 15u);
  v *= 0x846ca68bu;
  v ^= (v >> 16u);
  return v;
}
fn hash3i(p: vec3<i32>) -> vec3<f32> {
  let hx = hash_u32(bitcast<u32>(p.x) ^ 0xA511E9B3u);
  let hy = hash_u32(bitcast<u32>(p.y) ^ 0x63D83595u);
  let hz = hash_u32(bitcast<u32>(p.z) ^ 0x9E3779B9u);
  return vec3<f32>(f32(hx) * (1.0 / 4294967296.0), f32(hy) * (1.0 / 4294967296.0), f32(hz) * (1.0 / 4294967296.0));
}
fn smooth3(f: vec3<f32>) -> vec3<f32> {
  return f * f * (3.0 - 2.0 * f);
}

fn blended_tile_jitter(p: vec3<f32>, period: f32) -> vec3<f32> {
  let cellF = floor(p / period);
  let baseI = vec3<i32>(i32(cellF.x), i32(cellF.y), i32(cellF.z));

  let f = fract(p / period);
  let u = smooth3(f);

  // 8 corner jitters (cheap: just hashes + lerps)
  let j000 = (hash3i(baseI + vec3<i32>(0,0,0)) - 0.5) * period;
  let j100 = (hash3i(baseI + vec3<i32>(1,0,0)) - 0.5) * period;
  let j010 = (hash3i(baseI + vec3<i32>(0,1,0)) - 0.5) * period;
  let j110 = (hash3i(baseI + vec3<i32>(1,1,0)) - 0.5) * period;
  let j001 = (hash3i(baseI + vec3<i32>(0,0,1)) - 0.5) * period;
  let j101 = (hash3i(baseI + vec3<i32>(1,0,1)) - 0.5) * period;
  let j011 = (hash3i(baseI + vec3<i32>(0,1,1)) - 0.5) * period;
  let j111 = (hash3i(baseI + vec3<i32>(1,1,1)) - 0.5) * period;

  let x00 = mix(j000, j100, u.x);
  let x10 = mix(j010, j110, u.x);
  let x01 = mix(j001, j101, u.x);
  let x11 = mix(j011, j111, u.x);

  let y0 = mix(x00, x10, u.y);
  let y1 = mix(x01, x11, u.y);

  return mix(y0, y1, u.z);
}

fn galaxy_domain_seamless(stableWorldPos: vec3<f32>, galaxyScale: f32, period: f32) -> vec3<f32> {
  let p = stableWorldPos * galaxyScale;

  let jitter = blended_tile_jitter(p, period);

  return p + jitter;
}



@fragment
fn fs_main(@location(0) worldPos: vec3<f32>, @location(1) localPos: vec3<f32>, @location(2) stableWorldPos: vec3<f32>) -> @location(0) vec4<f32> {
  let edgeWidth: f32 = 0.018;
  let glowFalloff: f32 = 0.010;

  let aPos = abs(localPos);
  let wGlow = edge_weights(aPos, 0.4, edgeWidth, glowFalloff);
  let wNorm = edge_weights(aPos, 0.5, edgeWidth, glowFalloff);

  let mask = object.edgeMask;
  let selZ = select_quadrant(localPos.x, localPos.y, 1u<<0, 1u<<1, 1u<<2, 1u<<3, mask);
  let selY = select_quadrant(localPos.x, localPos.z, 1u<<4, 1u<<5, 1u<<6, 1u<<7, mask);
  let selX = select_quadrant(localPos.y, localPos.z, 1u<<8, 1u<<9, 1u<<10, 1u<<11, mask);
  let sel = vec3<f32>(selX, selY, selZ);

  let edgeGlow = dot(wGlow, sel);
  let edgeLine = dot(wNorm, vec3<f32>(1.0));

  let glow = pow(edgeGlow, 2.0);
    let edgeEmitColor = vec3<f32>(0.35, 0.75, 2.2); // cyan-blue HDR
  let emissive = edgeEmitColor * glow;

  let N = normalize(approxNormalFromLocal(localPos));
  let V = normalize(global.cameraWorldPos - worldPos);

  let fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);

  let galaxyScale: f32 = 0.18;
  let period: f32 = 512.0;
  let p = galaxy_domain_seamless(stableWorldPos, galaxyScale, period);
  var face = cosmicColor3D(p, global.time);



  face *= 0.35 + 0.85 * fres;

  let faceMask = 1.0 - smoothstep(0.05, 0.20, edgeLine);
  face *= faceMask;


  let dist = distance(worldPos, global.cameraWorldPos);
  let fog = fogFactorExp2(dist);
  let fogColor = vec3<f32>(0.003, 0.003, 0.004); // very dark void

  let inscatter = emissive * (0.12 + 0.25 * fog);

  let hdr = face + emissive + inscatter;

  let outColor = mix(hdr, fogColor, fog);

  return vec4<f32>(outColor, 1.0);
}


