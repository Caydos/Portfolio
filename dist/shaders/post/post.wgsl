struct VSOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) i : u32) -> VSOut {
  // Fullscreen triangle
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var uv = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(2.0, 0.0),
    vec2<f32>(0.0, 2.0)
  );

  var o : VSOut;
  o.position = vec4<f32>(pos[i], 0.0, 1.0);
  o.uv = uv[i];
  return o;
}

/* -------------------------------------------------------------------------- */
/* Single bind group for ALL passes                                            */
/* -------------------------------------------------------------------------- */

@group(0) @binding(0) var uSampler : sampler;
@group(0) @binding(1) var uSceneHDR : texture_2d<f32>;
@group(0) @binding(2) var uBloomIn  : texture_2d<f32>;

struct PostParams {
  texelSize      : vec2<f32>, // 1/width, 1/height (of bloom textures)
  dir            : vec2<f32>, // blur direction (1,0) or (0,1). unused in extract/composite
  threshold      : f32,       // extract threshold
  bloomStrength  : f32,       // composite strength
  exposure       : f32,       // tonemap exposure
  _pad           : f32,
};
@group(0) @binding(3) var<uniform> params : PostParams;

/* -------------------------------------------------------------------------- */

fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x*(a*x+b)) / (x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn uvFlip(uv: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(uv.x, 1.0 - uv.y);
}

@fragment
fn fs_extract(in : VSOut) -> @location(0) vec4<f32> {
  let uv = uvFlip(in.uv);

  let c = textureSample(uSceneHDR, uSampler, uv).rgb;

  // Dummy read to keep binding(2) in this entrypoint's layout
  let _dummyBloom = textureSample(uBloomIn, uSampler, uv).rgb;

  // Soft-knee threshold (cinematic bloom prefilter)
  let br = max(max(c.r, c.g), c.b);

  let t = params.threshold; // try 1.1–1.6
  let knee = 0.7;           // try 0.3–1.2

  // Smooth ramp from 0..1 around threshold
  let x = (br - t) / knee;
  let w = clamp(x, 0.0, 1.0);
  let ww = w * w * (3.0 - 2.0 * w); // smoothstep

  // Keep some color; emphasize highlights
  let outC = c * ww;

  return vec4<f32>(outC, 1.0);
}



@fragment
fn fs_blur(in : VSOut) -> @location(0) vec4<f32> {
  let uv = uvFlip(in.uv);

  // Dummy read so binding(1) is kept in this entrypoint’s layout
  let _dummyScene = textureSample(uSceneHDR, uSampler, uv).rgb;

  let o = params.texelSize * params.dir;

  var sum = vec3<f32>(0.0);
  sum += textureSample(uBloomIn, uSampler, uv + o * -4.0).rgb * 0.05;
  sum += textureSample(uBloomIn, uSampler, uv + o * -3.0).rgb * 0.09;
  sum += textureSample(uBloomIn, uSampler, uv + o * -2.0).rgb * 0.12;
  sum += textureSample(uBloomIn, uSampler, uv + o * -1.0).rgb * 0.15;
  sum += textureSample(uBloomIn, uSampler, uv).rgb            * 0.18;
  sum += textureSample(uBloomIn, uSampler, uv + o *  1.0).rgb * 0.15;
  sum += textureSample(uBloomIn, uSampler, uv + o *  2.0).rgb * 0.12;
  sum += textureSample(uBloomIn, uSampler, uv + o *  3.0).rgb * 0.09;
  sum += textureSample(uBloomIn, uSampler, uv + o *  4.0).rgb * 0.05;

  return vec4<f32>(sum, 1.0);
}

fn hash12(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

@fragment
fn fs_composite(in : VSOut) -> @location(0) vec4<f32> {
  let uv = uvFlip(in.uv);

  let scene = textureSample(uSceneHDR, uSampler, uv).rgb;
  let bloom = textureSample(uBloomIn, uSampler, uv).rgb;

  let hdr = scene + bloom * params.bloomStrength;

  // Tonemap
  let mapped = acesTonemap(hdr * params.exposure);

  // Gamma
  var outC = pow(mapped, vec3<f32>(1.0 / 2.2));

  // Subtle vignette (helps focus + mood)
  let p = (in.uv * 2.0 - vec2<f32>(1.0));
  let vig = 1.0 - 0.22 * dot(p, p); // 0.12–0.30
  outC *= vig;

  // Tiny dither to reduce banding (especially in near-black)
    let n = hash12(in.uv * 1920.0 + vec2<f32>(params.exposure, params.threshold));
  outC += (n - 0.5) / 255.0;

  return vec4<f32>(clamp(outC, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

