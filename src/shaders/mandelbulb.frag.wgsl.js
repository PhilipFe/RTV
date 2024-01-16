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

const MAX_RAY_LENGTH = 10.0;

const COLOR_NEAR = vec3<f32>(1.0, 1.0, 1.0);
const COLOR_FAR = vec3<f32>(0.15, 0.15, 0.8);

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

struct RayPoint {
    steps: f32,
    distance: f32
};
fn ray_marching(ray_origin: vec3<f32>, ray_dir: vec3<f32>) -> RayPoint {
    var d = mandelbulb_sdf(ray_origin);
    var pos = ray_origin + ray_dir * d;
    
    var result: RayPoint;
    result.distance = d;
    result.steps = 1;

    while(result.distance < MAX_RAY_LENGTH && d > param.epsilon) {
        d = mandelbulb_sdf(pos);
        pos += ray_dir * d;
        result.distance += d;
        result.steps += 1;
        
    }

    return result;
}

@fragment
fn main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    // camera
    let rayOrigin = camera.eye.xyz;
    let rayDir = normalize(camera.forward.xyz + (camera.right.xyz * uv.x/2) + (camera.up.xyz * uv.y/2)); 

    // raymarching
    let p = ray_marching(rayOrigin, rayDir);

    // color
    var ao = p.steps * 0.1;
    ao = (ao / (ao + 1));
    let f = clamp(pow(ao, 2), 0, 1);
    let c = mix(COLOR_NEAR, COLOR_FAR, f);
    return vec4<f32>(c, 1.0);   
}

`
