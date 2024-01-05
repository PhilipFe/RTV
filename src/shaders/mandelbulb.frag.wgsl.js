const bulb_frag = `

fn sphereDistanceEstimator(pos: vec3<f32>, radius: f32) -> f32 {
    return length(pos) - radius;
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
    // Calculate ray direction
    let rayOrigin = vec3<f32>(0.0, 0.0, -2.0); // Camera position
    let rayDir = normalize(vec3<f32>(ndcX * aspectRatio + 0.1, ndcY + 0.1, 2.3)); 

    //return vec4<f32>(rayDir, 1.0);
    //return vec4<f32>((rayDir * 0.5) + 0.5, 1.0); // Normalize and visualize the ray direction
    var t = 0.0;

    for(var i = 0; i < 100; i++) {
        let p = rayOrigin + t * rayDir;
        let dist = sphereDistanceEstimator(p, 0.8);
        if(dist < 0.001) {
            return vec4<f32>(t / 5.0, 0.0, 0.0, 1.0); // hit: red
        }

        t += dist;
    }

    // output as color
    return vec4<f32>(0.0, 0.0, 1.0, 1.0); // miss: black*/
}

`