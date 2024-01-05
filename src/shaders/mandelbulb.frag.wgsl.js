const bulb_frag = `

// later replace with mandelbulb
fn sphereDistanceEstimator(pos: vec3<f32>,center: vec3<f32>, radius: f32) -> f32 {
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
            return vec3<f32>(1.0, 0.0, 0.0); //hit: red (autsch)
        }

        if(total_distance_traveld > MAX_TRACE_DIST) {
            break;
        }

        total_distance_traveld += distance;
    }

    return vec3<f32>(0.2);
}

@fragment
fn main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {

    let canvasWidth = 1079.0;
    let canvasHeight = 1134.0;

    let aspectRatio = canvasWidth / canvasHeight; // TODO: correct later according to canvas width and height
    
    //map to ndc
    let ndcX = (fragCoord.x / canvasWidth) * 2.0 - 1.0;
    let ndcY = 1.0 - (fragCoord.y / canvasHeight) * 2.0;  // Flip Y-coordinate

    //return vec4<f32>((ndcX + 1.0) / 2.0, (ndcY + 1.0) / 2.0, 0.0, 1.0);

    //return vec4<f32>(ndcX, ndcY, 0.0, 1.0);

    //static camera setup:
    let rayOrigin = vec3<f32>(0.0, 0.0, 2.5); // Camera position
    let rayDir = normalize(vec3<f32>(ndcX * aspectRatio, ndcY, -1.0)); 

    //return vec4<f32>(rayDir, 1.0);
    //return vec4<f32>((rayDir * 0.5) + 0.5, 1.0); // Normalize and visualize the ray direction

    var color = ray_marching(rayOrigin, rayDir);
    return vec4<f32>(color, 1.0);
}

`
