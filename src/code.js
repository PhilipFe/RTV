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
let range_scale_text;
let range_epsilon;
let range_epsilon_text;
let range_max_iterations;
let range_max_iterations_text;
let range_power;
let range_power_text;
let range_bailout;
let range_bailout_text;
let button_reset;

// vis data
// pathData is an array of sections, each section representing a continuous movement period
// Each section has the following structure:
// {
//   startTime: [timestamp of the start of the section],
//   endTime: [timestamp of the end of the section],
//   camera: [{
//     pos: [x1, y1, z1], // Position of the camera at each second
//     rot: [pitch, 0, yaw], 
//     ...
//   }],
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

// parameters
let MAX_RAY_LENGTH = 10.0;
let MAX_SCALE = 1;
let MAX_ITER = 128;
let MAX_POWER = 16;
let MAX_BAILOUT = 10;

let MIN_EPSILON = 0.0000001;
let MIN_ITER = 5;
let MIN_POWER = 1;
let MIN_BAILOUT = 1.25;

let epsilon = 0.001;
let max_iter = 5.0;
let power = 12.0;
let bailout = 1.25;

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

            const cameraSettings = {
                pos: Array.from(camera.position()),
                rot: Array.from(camera.rotation())
            };

            currentSection.camera.push(cameraSettings);

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
    init_ui();

    // aux
    ts = performance.now();
    
    // other
    camera = new Camera(surface.width, surface.height);
    reset_mouse_accumulation();
    
    // events
    init_events();
    
    // webgpu
    reset_user();
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

//#region ui & events
//----------------------------------------------------------------------------------------------------------------------

function init_ui() {
    surface = document.getElementById('surface');
    range_scale = document.getElementById('range_scale');
    range_scale_text = document.getElementById('range_scale_value');
    range_epsilon = document.getElementById('range_epsilon');
    range_epsilon_text = document.getElementById('range_epsilon_value');
    range_max_iterations = document.getElementById('range_max_iterations');
    range_max_iterations_text = document.getElementById('range_max_iterations_value');
    range_power = document.getElementById('range_power');
    range_power_text = document.getElementById('range_power_value');
    range_bailout = document.getElementById('range_bailout');
    range_bailout_text = document.getElementById('range_bailout_value');
    button_reset = document.getElementById('button_reset');
}

function init_events() {
    surface.addEventListener('resize', surface_resized);
    surface.addEventListener('mousemove', surface_mousemove);
    surface.addEventListener('mousedown', surface_mousedown);
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
    
    range_scale.addEventListener('input', on_scale_changed);
    range_epsilon.addEventListener('input', on_epsilon_changed);
    range_max_iterations.addEventListener('input', on_max_iter_changed);
    range_power.addEventListener('input', on_power_changed);
    range_bailout.addEventListener('input', on_bailout_changed);

    button_reset.addEventListener('click', reset_user);

    update_parameter_tooltips();
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
                camera: [],
                parameters: []
            };
        }
    } else {
        document.exitPointerLock();

        // save recorded section
        if (isRecording && currentSection) {
            pathData.push(currentSection);
            //console.log("Section Recorded: ", currentSection);
            nextStartTime = currentSection.endTime;
            currentSection = null;
        }
    }
}


function on_scale_changed() {
    camera.scale = parseFloat(range_scale.value);
    range_scale.setAttribute('title', camera.scale);
}


function on_epsilon_changed() {
    range_epsilon.setAttribute('title', epsilon);
}

function on_max_iter_changed() {
    range_max_iterations.setAttribute('title', max_iter);
}

function on_power_changed() {
    range_power.setAttribute('title', power);
}

function on_bailout_changed() {
    range_bailout.setAttribute('title', bailout);
}

function update_parameter_tooltips() {
    range_scale_text.textContent = parseFloat(camera.scale).toFixed(2);
    range_epsilon_text.textContent = parseFloat(epsilon).toFixed(7);
    range_max_iterations_text.textContent = parseFloat(max_iter).toFixed(2);
    range_power_text.textContent = parseFloat(power).toFixed(2);
    range_bailout_text.textContent = parseFloat(bailout).toFixed(2);
}


function reset_user() {
    camera.setPosition(0, -3, 0);
    camera.setRotation(-90, 180);

    range_scale.value = 0.5;
    range_epsilon.value = 0.1;
    range_max_iterations.value = 0.1;
    range_power.value = 0.5;
    range_bailout.value = 0;
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
            camera: [],
            parameters: []
        };
    }
    
    // stop recording
    else if(e.code === "KeyR" && isRecording) {

        // push last data
        if(currentSection) {
            pathData.push(currentSection);
            //console.log("Section Recorded: ", currentSection);
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
        uniforms_parameters[0] = parseFloat(epsilon);
        uniforms_parameters[1] = parseFloat(max_iter);
        uniforms_parameters[2] = parseFloat(power);
        uniforms_parameters[3] = parseFloat(bailout);
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

    return (isNaN(distance) || distance <= 0) ? 0.0000001 : distance;
}


function adapt() {
    // distance to fractal surface
    var distance = ray_marching(Float32Array.from(camera.position()), Float32Array.from(camera.forward()));
    
    // parameters (manually tweaked)
    camera.scale = Math.max(1.0 / MAX_SCALE, Math.pow(1.0 / distance, 1.2) * (1.0 / (parseFloat(range_scale.value) + 0.0000001)));
    epsilon = MIN_EPSILON + Math.max(Math.pow(distance, 0.9) * 15 * (parseFloat(1.0 - range_epsilon.value) * 0.0001), 0);
    max_iter = Math.min(MAX_ITER, MIN_ITER + Math.log10(2.0 / distance) * 7 * parseFloat(range_max_iterations.value));

    power = MIN_POWER + (MAX_POWER - MIN_POWER - 1) * parseFloat(range_power.value);
    bailout = MIN_BAILOUT + (MAX_BAILOUT - MIN_BAILOUT) * parseFloat(range_bailout.value);
    
    // notify parameters changed
    state_parameters = 1;

    update_parameter_tooltips();
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region D3 visualiztion
//----------------------------------------------------------------------------------------------------------------------

function renderVisualization() {
    d3.select("#visualization").selectAll("*").remove();

    const data = preprocessData();

    const margin = { top: 20, right: 20, bottom: 40, left: 60 },
        width = 1000 - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;

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
        const startX = xScale(section.startTime);
        const startY = yScale(data[section.startTime].y)
        svg.append("line")
        .attr("x1", startX)
        .attr("x2", startX)
        .attr("y1", startY - 20)
        .attr("y2", startY + 20)
        .attr("stroke", "#ff0000")  // Red vertical line for visibility
        .attr("stroke-width", 1)

    })


    // hover text
    const bisect = d3.bisector(function(d) {return d.x;}).left;

    const focus = svg.append("g")
        .append("circle")
        .style("fill", "none")
        .attr("stroke", "black")
        .attr("r", 8.5)
        .style("opacity", 0);

    const focusText = svg.append("g")
        .append("text")
        .style("opacity", 0)
        .attr("text-anchor", "left")
        .attr("aligment-baseline", "middle")

    const updateText = (d) => {
        focusText.selectAll("*").remove();

        const textX = xScale(d.x) - 25;
        const textY = yScale(d.y) - 60;

        focusText
            .html("")
            .attr("x", textX)
            .attr("y", textY)
            .style("font-size", "12px")
            .attr("fill", "#EEEEEE")
            .style("opacity", 1)
            .append("tspan")
                .text("\u03B5: " + Number(d.epsilon).toFixed(7))
                .attr("x", textX)
                .attr("dy", 0)
            .append("tspan")
                .text("max iter: " + d.max_iter)
                .attr("x", textX)
                .attr("dy", "1.2em")
            .append("tspan")
                .text("power: " + d.power)
                .attr("x", textX)
                .attr("dy", "1.2em");
    };

    // append circles for click event
    svg.selectAll("circle.data-point")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 5)
        .style("opacity", 0)
        .on("mouseover", function(event, d) {
            focus.style("opacity", 1)
            focus
                .attr("cx", xScale(d.x))
                .attr("cy", yScale(d.y));

            updateText(d);
        })
        .on("mouseout", function() {
            focus.style("opacity", 0);
            focusText.style("opacity", 0);
        })
        .on("click", function(event, d) {
            jumpTo(d);
        });

    
}

function preprocessData() {
    let data = [];
    let time = 0;

    pathData.forEach(section => {
        section.camera.forEach((setting, i) => {
            data.push({
                x: time + i,
                y: distanceToBulb(setting.pos),
                pos: setting.pos,
                rot: setting.rot,
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
    return data;
}

function jumpTo(data) {

    camera.setPosition(data.pos[0], data.pos[1], data.pos[2]);
    camera.setRotation(data.rot[0], data.rot[2]);

    uniforms_parameters[0] = data.epsilon;
    uniforms_parameters[1] = data.max_iter;
    uniforms_parameters[2] = data.power;
    uniforms_parameters[3] = data.bailout;
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
    return `${dash}, ${gap}`;
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion