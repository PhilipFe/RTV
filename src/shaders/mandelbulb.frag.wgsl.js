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

// phong shading
const PHONG_COLOR = vec3<f32>(1, 1, 1);
const LIGHT_POS = vec3<f32>(0, -3, -3);;
const PHONG_INT = 0.5;
const PHONG_SPEC = 0.3;
const PHONG_AMBIENT = 0.2;

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

fn norm_estimate(p: vec3<f32>, epsilon: f32) -> vec3<f32> {
    let dx = vec3<f32>(epsilon, 0.0, 0.0);
    let dy = vec3<f32>(0.0, epsilon, 0.0);
    let dz = vec3<f32>(0.0, 0.0, epsilon);

    let p_dx = mandelbulb_distance_estimator(p + dx);
    let p_dy = mandelbulb_distance_estimator(p + dy);
    let p_dz = mandelbulb_distance_estimator(p + dz);
    let p_minus_dx = mandelbulb_distance_estimator(p - dx);
    let p_minus_dy = mandelbulb_distance_estimator(p - dy);
    let p_minus_dz = mandelbulb_distance_estimator(p - dz);

    let normal = normalize(vec3<f32>(
        p_dx - p_minus_dx,
        p_dy - p_minus_dy,
        p_dz - p_minus_dz
    )); 

    return normal;
}

struct RayMarchResult {
    distance: f32,
    normal: vec3<f32>,
}

fn ray_marching(rayOrigin: vec3<f32>, rayDir: vec3<f32>) -> RayMarchResult {
    var total_distance = 0.0;
    var normal = vec3<f32>(0.0);
    
    for(var i = 0; i < NUM_STEPS; i++) {
        var current_pos = rayOrigin + total_distance * rayDir;
        var distance = mandelbulb_distance_estimator(current_pos);
        total_distance += distance;

        if(distance < MIN_HIT_DIST) {
            normal = norm_estimate(current_pos, 0.001);
            break;
        }

        if(total_distance > MAX_TRACE_DIST) {
            break;
        }
    }
    var result: RayMarchResult;
    result.distance = total_distance;
    result.normal = normal;
    return result;
}

fn phong_shading(normal: vec3<f32>, viewPos: vec3<f32>) -> vec3<f32> {
    let lightDir = normalize(LIGHT_POS - viewPos);
    let diffuse = max(dot(normal, lightDir), 0.0) * PHONG_INT;

    let viewDir = normalize(viewPos - LIGHT_POS);
    let refelctDir = reflect(-lightDir, normal);
    let specular = pow(max(dot(viewDir, refelctDir), 0.0), 32.0) * PHONG_SPEC;

    let ambient = PHONG_AMBIENT * PHONG_INT;
    return (ambient + diffuse + specular) * PHONG_COLOR;
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

    var result = ray_marching(rayOrigin, rayDir);

    if(result.distance > MAX_TRACE_DIST) {
        return vec4<f32>(vec3<f32>(0), 1);
    }

    var pos = rayOrigin + rayDir * result.distance;
    var diffuse = phong_shading(result.normal, pos);
    return vec4<f32>(vec3<f32>(ambient + diffuse), 1.0);
}

`
