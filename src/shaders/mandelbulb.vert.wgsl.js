const bulb_vert = `

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
}

@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4<f32>(f32((VertexIndex * 2) & 2) * 2 - 1, f32(VertexIndex & 2) * -2 + 1, 0.0, 1.0);
    return output;
}

`