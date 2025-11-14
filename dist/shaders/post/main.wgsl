// Fullscreen triangle
struct VSOut {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index : u32) -> VSOut {
    var out : VSOut;

    // full-screen triangle trick
    let x = f32((i32(vertex_index) << 1) & 2);
    let y = f32(i32(vertex_index) & 2);
    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);

    return out;
}

@group(0) @binding(0) var mySampler : sampler;
@group(0) @binding(1) var myTexture : texture_2d<f32>;

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    let color = textureSample(myTexture, mySampler, in.uv);
    // later: do bloom here
    return color;
}
