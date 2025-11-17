struct VSOut {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VSOut {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0),
    );
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(2.0, 0.0),
        vec2<f32>(0.0, 2.0),
    );

    var out : VSOut;
    out.position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    out.uv = uvs[VertexIndex];
    return out;
}

@group(0) @binding(0) var uSampler : sampler;
@group(0) @binding(1) var uScene  : texture_2d<f32>;

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    let flippedUv = vec2<f32>(in.uv.x, 1- in.uv.y);
    let color = textureSample(uScene, uSampler, flippedUv);
    return color;
}
