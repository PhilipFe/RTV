const bulb_frag = `

struct Camera {
    eye: vec4<f32>,
    right: vec4<f32>,
    up: vec4<f32>,
    forward: vec4<f32>,
};
struct Parameters {
    epsilon: f32,
    max_iter: f32,
    power: f32,
    bailout: f32,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> param: Parameters;

//--------------------------------------------------------------------------------------------------------------------

const MAX_RAY_LENGTH = 200.0;

//--------------------------------------------------------------------------------------------------------------------

fn mandelbulb_sdf(pos: vec3<f32>) -> f32 {
    var z = pos;
    var dr = 1.0; // derivative
    var r = 0.0;

    for(var i = 0; i < i32(param.max_iter); i++) {
        r = length(z);
        if(r > param.bailout) {
            break;
        }

        // to polar
        var theta = acos(z.z / r);
        var phi = atan2(z.y, z.x);
        dr = pow(r, param.power - 1.0) * param.power * dr + 1.0;

        // scale and rotate
        var zr = pow(r, param.power);
        theta = theta * param.power;
        phi = phi * param.power;

        // to cartesian 
        z = zr * vec3<f32>(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + pos;
    }

    return 0.5 * log(r) * r / dr;    
}

fn ray_marching(ray_origin: vec3<f32>, ray_dir: vec3<f32>) -> f32 {
    var d = mandelbulb_sdf(ray_origin);
    var pos = ray_origin + ray_dir * d;
    var distance = d;
    var steps = 1;

    while(distance < MAX_RAY_LENGTH && d > param.epsilon) {
        d = mandelbulb_sdf(pos);
        pos += ray_dir * d;
        distance += d;
        steps++;
        
    }

    return f32(steps);
}

fn heatmap(steps: f32) -> vec3<f32> {
    let t = steps / param.max_iter;

    let close_color = vec3<f32>(0.68, 0.52, 0.61); //(0.56, 0.39, 0.49);
    let far_color = vec3<f32>(1.0, 0.88, 0.61);

    return mix(far_color, close_color, t);
}

fn desaturate(color: vec3<f32>, factor: f32) -> vec3<f32> {
    let gray = dot(color, vec3<f32>(0.33, 0.33, 0.33));
    return mix(color, vec3(gray), 0.0);
}

@fragment
fn main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    // camera
    let rayOrigin = camera.eye.xyz;
    let rayDir = normalize(camera.forward.xyz + (camera.right.xyz * uv.x/2) + (camera.up.xyz * uv.y/2)); 

    // raymarching
    let steps = ray_marching(rayOrigin, rayDir);

    let heatmap_color = heatmap(steps);

    // cheap AO
    var ao = steps * 0.025;         // more steps ~= more occlusion 
    ao = 1.0 - (ao / (ao + 1.0));   // normalize to [0, 1] | invert (since less occlusion -> higher intensity)

    var color = desaturate(heatmap_color, 1.0 - ao);
    color = mix(color * ao, heatmap_color, 0.5);
    return vec4<f32>(color, 1.0);
}

`
