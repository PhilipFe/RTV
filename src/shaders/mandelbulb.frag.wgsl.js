const bulb_frag = `

struct Uniforms {
    eye: vec4<f32>,
    right: vec4<f32>,
    up: vec4<f32>,
    forward: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

//--------------------------------------------------------------------------------------------------------------------

const NUM_STEPS = 32;
const MIN_HIT_DIST = 0.01;
const MAX_TRACE_DIST = 1000.0;
const light_pos = vec3<f32>(0, -3, -3);
const intensity = 0.6;
const ambient = 0.1;
const sphere = vec4<f32>(0, 0, 0, 0.2);

// mandelbulb
// TODO: uniform power
const MAX_ITERATIONS = 8; // changes shape
const POWER = 12; // adds detail
const BAILOUT = 2.0;

//--------------------------------------------------------------------------------------------------------------------

fn mandelbulb_distance_estimator(pos: vec3<f32>) -> f32 {
    var z = pos;
    var dr = 1.0;
    var r = 0.0;

    for(var i = 0; i < NUM_STEPS; i++) {
        r = length(z);
        if(r > BAILOUT) {
            break;
        }
        // convert  to polar
        var theta = acos(z.z/r);
        var phi = atan2(z.y, z.x);
        dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;

        // scale and rotate
        var zr = pow(r, POWER);
        theta = theta * POWER;
        phi = phi * POWER;

        // back to cartesian 
        z = zr * vec3<f32>(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + pos;
    }

    return 0.5 * log(r) * r / dr;    
}

// later replace with mandelbulb
fn sphere_distance_estimator(pos: vec3<f32>) -> f32 {
    return length(pos - sphere.xyz) - sphere.w;
}

fn ray_marching(rayOrigin: vec3<f32>, rayDir: vec3<f32>) -> f32 {
    var total_distance = 0.0;
    
    for(var i = 0; i < NUM_STEPS; i++) {
        var current_pos = rayOrigin + total_distance * rayDir;
        var distance = mandelbulb_distance_estimator(current_pos);
        total_distance += distance;

        if(total_distance > MAX_TRACE_DIST || distance < MIN_HIT_DIST) {
            break;
        }
    }
    return total_distance;
}

fn get_light(pos: vec3<f32>) -> f32 {
    var l = normalize(light_pos - pos);
    var n = normalize(pos - sphere.xyz);
    var light = clamp(dot(l, n) * intensity, 0, 1);
    return light;
}

@fragment
fn main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {

    /*let canvasWidth = 1079.0;
    let canvasHeight = 1134.0;

    let aspectRatio = canvasWidth / canvasHeight; // TODO: correct later according to canvas width and height
    */

    //static camera setup:
    let rayOrigin = u.eye.xyz;
    var rayDir = normalize(u.forward.xyz + (u.right.xyz * uv.x/2 * u.eye.w) + (u.up.xyz * uv.y/2)); 

    var distance = ray_marching(rayOrigin, rayDir);

    if(distance > MAX_TRACE_DIST) {
        return vec4<f32>(vec3<f32>(0), 1);
    }

    var pos = rayOrigin + rayDir * distance;
    var diffuse = get_light(pos);
    return vec4<f32>(vec3<f32>(ambient + diffuse), 1.0);
}

`
