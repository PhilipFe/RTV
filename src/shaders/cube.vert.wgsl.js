const cube_vert = `

struct Uniforms {
    pv: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) fragUV : vec2<f32>,
    @location(1) fragPosition: vec4<f32>,
}

@vertex
fn main(
    @location(0) position : vec4<f32>,
    @location(1) uv : vec2<f32>
) -> VertexOutput {
    var output : VertexOutput;
    output.position = u.pv * position;
    output.fragUV = uv;
    output.fragPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
    return output;
}

`