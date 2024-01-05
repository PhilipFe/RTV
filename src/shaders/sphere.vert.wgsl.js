const sphere_vert = `

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
}

@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    output.uv = vec2<f32>(f32((VertexIndex * 2) & 2) * 2 - 1, f32(VertexIndex & 2) * 2 - 1);
    output.position = vec4<f32>(output.uv, 0, 1);
    return output;
}

`