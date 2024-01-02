const triangle_vert = `

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) vertex_color : vec3<f32>,
}

@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4<f32>(f32((VertexIndex * 2) & 2) * 2 - 1, f32(VertexIndex & 2) * -2 + 1, 0.0, 1.0);
    output.vertex_color = vec3<f32>(f32(VertexIndex == 0), f32(VertexIndex & 1), f32(VertexIndex & 2));
    return output;
}
`