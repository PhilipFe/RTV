//#region vars
//----------------------------------------------------------------------------------------------------------------------

// webgpu
let adapter;
let device;
let context;
let swapchain_format;

let renderpass_descriptor;
let pipeline;
let uniforms_camera_buffer;
let uniforms_parameters_buffer;
let pipeline_bindgroup;

let uniforms_camera;
let uniforms_parameters;

// ui
let surface;
let range_scale;
let range_epsilon;
let range_max_iterations;
let range_power;
let range_bailout;

// vis data
// pathData is an array of sections, each section representing a continuous movement period
// Each section has the following structure:
// {
//   startTime: [timestamp of the start of the section],
//   endTime: [timestamp of the end of the section],
//   path: [
//     [x1, y1, z1], // Position of the camera at each second
//     [x2, y2, z2], 
//     ...
//   ],
//   parameters: [
//     { epsilon: value, max_iter: value, power: value, bailout: value }, // Parameters at each second
//     ...
//   ]
// }
let pathData = [];
let isRecording = false;
let currentSection = null;
let lastTime = 0;
const saveTime = 1000; // save data every second
let = nextStartTime = 0;

// aux
let ts;
let dt;
let camera_enabled = false;
let state_parameters = 1; // 0 - default | 1 - changed | 2 - awaiting upload to gpu

// other
let input = {};
let camera;

let MAX_RAY_LENGTH = 200.0;

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region main
//----------------------------------------------------------------------------------------------------------------------

// mainloop
function run() {
    let now = performance.now();
    dt = (now - ts)/1000;
    ts = now;
    
    update();
    draw(device, context, pipeline);

    requestAnimationFrame(run);
}

// logic
function update() {
    // input
    if(camera_enabled) {
        camera.update(dt, input);

        const currentTime = performance.now();

        // update path data
        if(isRecording && currentSection && (currentTime - lastTime >= saveTime)) {

            const pos = Array.from(camera.position());
            currentSection.path.push(pos);

            const settings =  {
                epsilon: uniforms_parameters[0],
                max_iter: uniforms_parameters[1],
                power: uniforms_parameters[2],
                bailout: uniforms_parameters[3]
            }
            currentSection.parameters.push(settings);
            currentSection.endTime += 1;

            lastTime = currentTime;
        }

    }

    adapt();

    reset_mouse_accumulation();
    update_uniforms();
}

// graphics
function draw() {
    // uniforms | cpu -> gpu
    upload_uniforms();
    
    // drawing
    renderpass_descriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    const commandEncoder = device.createCommandEncoder();
    const renderpass = commandEncoder.beginRenderPass(renderpass_descriptor);
    renderpass.setViewport(0, 0, surface.width, surface.height, 0, 1);
    renderpass.setPipeline(pipeline);
    renderpass.setBindGroup(0, pipeline_bindgroup);
    renderpass.draw(3);
    renderpass.end();
    device.queue.submit([commandEncoder.finish()]);
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region init
//----------------------------------------------------------------------------------------------------------------------

function init() {
    // ui
    surface = document.getElementById('surface');
    range_scale = document.getElementById('range_scale');
    range_epsilon = document.getElementById('range_epsilon');
    range_max_iterations = document.getElementById('range_max_iterations');
    range_power = document.getElementById('range_power');
    range_bailout = document.getElementById('range_bailout');

    // aux
    ts = performance.now();
    
    // other
    camera = new Camera(surface.width, surface.height);
    reset_mouse_accumulation();
    
    // events
    surface.addEventListener('resize', surface_resized);
    surface.addEventListener('mousemove', surface_mousemove);
    surface.addEventListener('mousedown', surface_mousedown);
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
    range_scale.addEventListener('input', on_scale_changed);
    range_epsilon.addEventListener('input', on_parameters_changed);
    range_max_iterations.addEventListener('input', on_parameters_changed);
    range_power.addEventListener('input', on_parameters_changed);
    range_bailout.addEventListener('input', on_parameters_changed);
    
    // webgpu
    setup_uniforms();
    surface_resized();
    init_webgpu().then(() => {
        console.log('webgpu initialized!');
    });

    // d3 visualization
    renderVisualization(/*data*/);
}

// webgpu
async function init_webgpu() {
    adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = surface.getContext('webgpu');
    swapchain_format = navigator.gpu.getPreferredCanvasFormat();
    
    context.configure({
        device,
        format: swapchain_format,
        alphaMode: 'premultiplied',
    });

    // pipeline
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
        ],
    });
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });
    pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({
                code: bulb_vert,
            }),
            entryPoint: 'main',
        },
        fragment: {
            module: device.createShaderModule({
                code: bulb_frag,
            }),
            entryPoint: 'main',
            targets: [{
                format: swapchain_format,
            }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    // uniforms
    uniforms_camera_buffer = device.createBuffer({
        size: uniforms_camera.byteLength, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    uniforms_parameters_buffer = device.createBuffer({
        size: uniforms_parameters.byteLength, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    pipeline_bindgroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { 
                binding: 0, 
                resource: { 
                    buffer: uniforms_camera_buffer 
                }
            },
            { 
                binding: 1, 
                resource: { 
                    buffer: uniforms_parameters_buffer
                }
            },
        ],
    });

    // renderpass
    renderpass_descriptor = {
        colorAttachments: [{
            view: undefined,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    };


    requestAnimationFrame(run);
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region events
//----------------------------------------------------------------------------------------------------------------------

function on_scale_changed() {
    camera.scale = parseFloat(range_scale.value);
}

function on_parameters_changed() {
    state_parameters = 1;

    // update visualization
    //renderVisualization(/*update Data*/)
}


function surface_resized() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    surface.width = surface.clientWidth * devicePixelRatio;
    surface.height = surface.clientHeight * devicePixelRatio;
    camera.resized(surface.width, surface.height);
}

function surface_mousemove(e) {
    input['x'] += e.movementX;
    input['y'] += e.movementY;
}

function surface_mousedown() {
    camera_enabled = !camera_enabled;
    if(camera_enabled) {
        surface.requestPointerLock();

        // start recording current section
        if(isRecording) {
            currentSection = {
                startTime: nextStartTime,
                endTime: nextStartTime,
                path: [],
                parameters: []
            };
        }
    } else {
        document.exitPointerLock();

        // save recorded section
        if (isRecording && currentSection) {
            pathData.push(currentSection);
            console.log("Section Recorded: ", currentSection);
            nextStartTime = currentSection.endTime;
            currentSection = null;
        }
    }
}


function keydown(e) {
    input[e.code] = true;

    // start recording
    if(e.code === "KeyR" && !isRecording) {
        isRecording = true;
        pathData = [];
        console.log("Recording started");
        currentSection = {
            startTime: 0,
            endTime: 0,
            path: [],
            parameters: []
        };
    }
    
    // stop recording
    else if(e.code === "KeyR" && isRecording) {

        // push last data
        if(currentSection) {
            pathData.push(currentSection);
            console.log("Section Recorded: ", currentSection);
            currentSection = null;
        }
        
        isRecording = false;
        console.log("Recording stopped. Data: ", pathData);
        renderVisualization();
    }
}

function keyup(e) {
    input[e.code] = false;
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region aux
//----------------------------------------------------------------------------------------------------------------------

// uniforms

function setup_uniforms() {
    uniforms_camera = new Float32Array(16); 
    uniforms_parameters = new Float32Array(4);
    update_uniforms();
}

function update_uniforms() {
    // camera
    uniforms_camera.set(camera.position(), 0);
    uniforms_camera.set(vec4.mulScalar(camera.right(), surface.clientWidth/surface.clientHeight), 4);
    uniforms_camera.set(camera.up(), 8);
    uniforms_camera.set(camera.forward(), 12);

    // parameters
    if(state_parameters == 1) {
        let e = (parseFloat(range_epsilon.min) + (parseFloat(range_epsilon.max) - parseFloat(range_epsilon.value))) / 10;
        e = Math.max(e * e * e, 0.0000001); // catch float32 machine precision

        uniforms_parameters[0] = e;
        uniforms_parameters[1] = parseFloat(range_max_iterations.value);
        uniforms_parameters[2] = parseFloat(range_power.value);
        uniforms_parameters[3] = parseFloat(range_bailout.value);
        state_parameters = 2;
    }
}

function upload_uniforms() {
    device.queue.writeBuffer(uniforms_camera_buffer, 0, uniforms_camera);
    if(state_parameters == 2) {
        device.queue.writeBuffer(uniforms_parameters_buffer, 0, uniforms_parameters);
        state_parameters = 0;
    }
}

// mouse

function reset_mouse_accumulation() {
    input['x'] = 0;
    input['y'] = 0;
}


// adaptive parameters

function mandelbulb_sdf(pos) {
    var z = Float32Array.from(pos);
    var dr = 1.0; // derivative
    var r = 0.0;

    var maxIter = parseInt(uniforms_parameters[1])
    var power = uniforms_parameters[2];
    var bailout = uniforms_parameters[3];

    for(var i = 0; i < maxIter; i++) {
        r = vec3.length(z);
        if(r > bailout) {
            break;
        }

        // to polar
        var theta = Math.acos(z[2] / r);
        var phi = Math.atan2(z[1], z[0]);
        dr = Math.pow(r, power - 1.0) * power * dr + 1.0;

        // scale and rotate
        var zr = Math.pow(r, power);
        theta = theta * power;
        phi = phi * power;

        // to cartesian 
        var delta = vec3.fromValues(Math.sin(theta) * Math.cos(phi), Math.sin(phi) * Math.sin(theta), Math.cos(theta));
        vec3.add(vec3.mulScalar(delta, zr), pos, z);
    }

    return 0.5 * Math.log(r) * r / dr;    
}

function ray_marching(ray_origin, ray_dir) {
    var d = mandelbulb_sdf(ray_origin);
    var pos = vec3.add(ray_origin, vec3.mulScalar(ray_dir, d));
    var distance = d;
    var steps = 1;

    var epsilon = uniforms_parameters[0];

    while(steps < 10 && d > epsilon) {
        d = mandelbulb_sdf(pos);
        vec3.add(pos, vec3.mulScalar(ray_dir, d), pos);
        distance += d;
        steps++;
    }

    return distance;
}

function adapt() {
    // distance to fractal surface
    var distance = ray_marching(Float32Array.from(camera.position()), Float32Array.from(camera.forward()));
    
    // scale (movement speed / fractal size)
    range_scale.value = Math.pow(1.0 / distance, 1.2);
    on_scale_changed();

    // details
    range_epsilon.value = range_epsilon.max - Math.pow(distance, 0.8) * 15;
    
    // depth
    range_max_iterations.value = parseFloat(range_max_iterations.min) * 2 + Math.log10(2.0 / distance) * 7;
    
    on_parameters_changed();
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region D3 visualiztion
//----------------------------------------------------------------------------------------------------------------------

function renderVisualization() {
    d3.select("#visualization").selectAll("*").remove();

    const data = preprocessData();
    const margin = { top: 20, right: 20, bottom: 40, left: 60 },
        width = 500 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#visualization")
        .append("svg")
            .attr("width",  width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .style("background-color", "white");

    // X Axis
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]);
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + margin.top + 20)
        .text("time (s)")
        .attr("fill", "#EEEEEE");
    
    // Y Axis

    const rangeY = d3.extent(data, d=>d.y);

    const yScale = d3.scaleLinear()
        .domain([0, rangeY[1]])
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(yScale));
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top)
        .text("Distance to Fractal")
        .attr("fill", "#EEEEEE");

    // Line
    const colorScale = d3.scaleLinear()
        .domain([2, 32])
        .range(["#b7e8ff", "#1b2b33"]);

    data.forEach((point, i) => {
        if (i < data.length - 1) {
            const line = d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.y))
                .curve(d3.curveMonotoneX);

            svg.append("path")
                .datum([point, data[i + 1]])
                .attr("fill", "none")
                .attr("stroke", colorScale(point.max_iter))
                .attr("stroke-width", 5)
                .attr("stroke-linecap", "round")
                .attr("stroke-dasharray", lineSpacing(point.epsilon))
                .attr("d", line);
        }

    });

    // seperate sections
    pathData.forEach(section => {
        const startX = xScale(section.endTime);
        console.log("start: ", startX);
        svg.append("line")
        .attr("x1", startX)
        .attr("x2", startX)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#ff0000")  // Red vertical line for visibility
        .attr("stroke-width", 1)
        .style("opacity", 0.7);

    })


}

function preprocessData() {
    let data = [];
    let time = 0;

    pathData.forEach(section => {
        section.path.forEach((pos, i) => {
            data.push({
                x: time + i,
                y: distanceToBulb(pos),
                epsilon: section.parameters[i].epsilon,
                max_iter: section.parameters[i].max_iter,
                power: section.parameters[i].power,
                bailout: section.parameters[i].bailout,

            });
        });
        time = section.endTime;
        let duration = (section.endTime - section.startTime) / 1000
        time += Math.round(duration);
    });

    console.log("data: ", data);

    return data;
}

function distanceToBulb(pos) {
    return Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
}

function lineSpacing(epsilon) {
    if(epsilon >= 0.001) return "1, 0"; // solid line
    
    const minDash = 50;
    const maxDash = 2;
    let normEpsilon = 1 - (epsilon - 0.0000001) / (0.001 - 0.0000001);

    let dash = minDash + (maxDash - minDash) * normEpsilon;
    let gap = 10;
    console.log("spacing: ", `${dash}, ${gap}`);
    return `${dash}, ${gap}`;
}

function generateLine(data) {
    let segments = [];
    let currentSegment = { data: [], epsilon: data[0].epsilon };

    data.forEach((point, index) => {
        if (point.epsilon !== currentSegment.epsilon) {
            segments.push(currentSegment);
            currentSegment = { data: [], epsilon: point.epsilon };
        }
        currentSegment.data.push(point);
    });
    segments.push(currentSegment); // push the last segment

    return segments;
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion