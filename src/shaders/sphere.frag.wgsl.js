const sphere_frag = `

struct Uniforms {
    eye: vec4<f32>,
    right: vec4<f32>,
    up: vec4<f32>,
    forward: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

//--------------------------------------------------------------------------------------------------------------------

const NUM_STEPS = 32;
const MAX_DIST = 1000.0;
const MIN_DIST = 0.01;
const light_pos = vec3<f32>(0, -3, -3);
const intensity = 0.6;
const ambient = 0.1;
const sphere = vec4<f32>(0, 0, 0, 0.2);

//--------------------------------------------------------------------------------------------------------------------

fn get_distance(pos: vec3<f32>) -> f32 {
    return length(pos - sphere.xyz) - sphere.w;
}

fn ray_march(ray_origin: vec3<f32>, ray_dir: vec3<f32>) -> f32 {
    var d = 0.0;
    for(var i = 0; i < NUM_STEPS; i++) {
        var pos = ray_origin + ray_dir * d;
        var distance = get_distance(pos);
        d += distance;
        if(d > MAX_DIST || distance < MIN_DIST) {
            break;
        }
    }
    return d;
}

fn get_light(pos: vec3<f32>) -> f32 {
    var l = normalize(light_pos - pos);
    var n = normalize(pos - sphere.xyz);
    var light = clamp(dot(l, n) * intensity, 0, 1);
    return light;
}

@fragment
fn main(
    @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
    var rayOrigin = u.eye.xyz;
    var rayDir = normalize(u.forward.xyz + (u.right.xyz * uv.x/2 * u.eye.w) + (u.up.xyz * uv.y/2)); 

    var d = ray_march(rayOrigin, rayDir);
    if(d > MAX_DIST) {
        return vec4<f32>(vec3<f32>(0.2), 1);
    }

    var pos = rayOrigin + rayDir * d;
    var diffuse = get_light(pos);
    return vec4<f32>(vec3<f32>(ambient + diffuse), 1.0);
}

`