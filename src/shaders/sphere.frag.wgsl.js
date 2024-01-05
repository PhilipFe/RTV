const sphere_frag = `

struct Uniforms {
    eye: vec4<f32>,
    dir: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

// later replace with mandelbulb
fn sphereDistanceEstimator(pos: vec3<f32>, center: vec3<f32>, radius: f32) -> f32 {
    return length(pos - center) - radius;
}

fn ray_marching(rayOrigin: vec3<f32>, rayDir: vec3<f32>) -> vec3<f32> {
    var total_distance_traveld = 0.0;
    const NUM_STEPS = 32;
    const MIN_HIT_DIST = 0.001;
    const MAX_TRACE_DIST = 1000.0;

    for(var i = 0; i < NUM_STEPS; i++) {
        var current_pos = rayOrigin + total_distance_traveld * rayDir;
        var distance = sphereDistanceEstimator(current_pos, vec3<f32>(-1.2, 1.7, 0.5), 0.2);

        if(distance < MIN_HIT_DIST) {
            return vec3<f32>(1.0, 0.0, 0.0); //hit: red (autsch? ouch! )
        }

        if(total_distance_traveld > MAX_TRACE_DIST) {
            break;
        }

        total_distance_traveld += distance;
    }

    return vec3<f32>(0.2);
}

@fragment
fn main(
    @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
    var rayOrigin = u.eye.xyz;
    var rayDir = normalize(u.dir.xyz + vec3<f32>(uv.x, 1.0, uv.y)); 

    var color = ray_marching(rayOrigin, rayDir);
    return vec4<f32>(color, 1.0);
}

`