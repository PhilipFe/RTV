//#region vars
//----------------------------------------------------------------------------------------------------------------------

// WebGPU variables
/** 
 * WebGPU Adapter 
 * @type {GPUAdapter} 
 */
let adapter;
/** 
 * WebGPU Device 
 * @type {GPUDevice} 
 */
let device;
/** 
 * WebGPU Canvas Context 
 * @type {GPUCanvasContext} 
 */
let context;
/** 
 * Swap chain format for WebGPU
 * @type {GPUTextureFormat} 
 */
let swapchain_format;

/** 
 * Render pass descriptor for WebGPU 
 * @type {GPURenderPassDescriptor} 
 */
let renderpass_descriptor;
/** 
 * Pipeline for rendering 
 * @type {GPURenderPipeline} 
 */
let pipeline;
/** 
 * Uniform buffer for camera 
 * @type {GPUBuffer} 
 */
let uniforms_camera_buffer;
/** 
 * Uniform buffer for parameters 
 * @type {GPUBuffer} 
 */
let uniforms_parameters_buffer;
/** 
 * Pipeline bind group 
 * @type {GPUBindGroup} 
 */
let pipeline_bindgroup;

/** 
 * Uniform data for camera 
 * @type {Float32Array} 
 */
let uniforms_camera;
/** 
 * Uniform data for parameters 
 * @type {Float32Array} 
 */
let uniforms_parameters;

// UI variables
/** 
 * Surface for rendering
 * @type {HTMLCanvasElement}
 */ 
let surface;
/** @type {HTMLInputElement}*/
let range_scale;
/** @type {HTMLInputElement}*/
let range_scale_text;
/** @type {HTMLInputElement}*/
let range_epsilon;
/** @type {HTMLInputElement}*/
let range_epsilon_text;
/** @type {HTMLInputElement}*/
let range_max_iterations;
/** @type {HTMLInputElement}*/
let range_max_iterations_text;
/** @type {HTMLInputElement}*/
let range_power;
/** @type {HTMLInputElement}*/
let range_power_text;
/** @type {HTMLInputElement}*/
let range_bailout;
/** @type {HTMLInputElement}*/
let range_bailout_text;

let color_near;
let color_far;
let button_reset;


// Visualization data
/** pathData is an array of sections, each section representing a continuous movement period
* Each section has the following structure:
* {
*   startTime: [timestamp of the start of the section],
*   endTime: [timestamp of the end of the section],
*   camera: [{
*     pos: [x1, y1, z1], // Position of the camera at each second
*     rot: [pitch, 0, yaw], 
*     ...
*   }],
*   parameters: [
*     { epsilon: value, max_iter: value, power: value, bailout: value }, // Parameters at each second
*     ...
*   ]
* }
*/
let pathData = [];
/** 
 * Flag to indicate if recording is active 
 * @type {boolean} 
 */
let isRecording = false;
/** 
 * Current section being recorded 
 * @type {Object} 
 */
let currentSection = null;
/** 
 * Last recorded time 
 * @type {number} 
 */
let lastTime = 0;
/** 
 * Interval for saving data (in milliseconds) 
 * @type {number} 
 */
const saveTime = 1000; 
/** 
 * Next start time for a section 
 * @type {number} 
 */
let nextStartTime = 0;

// Auxiliary variables
/** 
 * Timestamp for the current frame 
 * @type {number} 
 */
let ts;
/** 
 * Delta time between frames 
 * @type {number} 
 */
let dt;
/** 
 * Flag to enable camera updates 
 * @type {boolean} 
 */
let camera_enabled = false;
/** 
 * State of parameters (0 - default, 1 - changed, 2 - awaiting upload) 
 * @type {number} 
 */
let state_parameters = 1;

// Other variables
/** 
 * Input controls 
 * @type {Object} 
 */
let input = {};
/** 
 * Camera object 
 * @type {Camera} 
 */
let camera;

// parameters
/** @type {number}*/
let MAX_RAY_LENGTH = 10.0;
/** @type {number}*/
let MAX_SCALE = 1;
/** @type {number}*/
let MAX_ITER = 128;
/** @type {number}*/
let MAX_POWER = 16;
/** @type {number}*/
let MAX_BAILOUT = 10;

/** @type {number}*/
let MIN_EPSILON = 0.0000001;
/** @type {number}*/
let MIN_ITER = 5;
/** @type {number}*/
let MIN_POWER = 1;
/** @type {number}*/
let MIN_BAILOUT = 1.25;

/** @type {number}*/
let epsilon = 0.0026175;
/** @type {number}*/
let max_iter = 4.99;
/** @type {number}*/
let power = 8.0;
/** @type {number}*/
let bailout = 1.25;

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region main
//----------------------------------------------------------------------------------------------------------------------

/**
 * Main loop function which updates and renders each frame.
 */
function run() {
    let now = performance.now();
    dt = (now - ts)/1000;
    ts = now;
    
    update();
    draw(device, context, pipeline);

    requestAnimationFrame(run);
}

/**
 * Updates the logic for each frame, including camera and input processing.
 */
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

/**
 * Handles the rendering of each frame, updating GPU resources and executing the render pass.
 */
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

/**
 * Initializes the application. Sets up UI, events, WebGPU, and D3 visualization.
 */
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
    renderVisualization();
    renderRecordingState();
}

/**
 * Initializes WebGPU components including device, context, pipeline, and uniforms.
 * @returns {Promise<void>} A promise that resolves when WebGPU is fully initialized.
 */
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

/**
 * Initializes UI elements by querying and storing references to DOM elements.
 */
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

    color_near = document.getElementById('color_near');
    color_far = document.getElementById('color_far');
    button_reset = document.getElementById('button_reset');
}

/**
 * Sets up event listeners for UI interactions and other user inputs.
 */
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

/**
 * Handles the resize event for the surface.
 * Updates the dimensions of the rendering surface and the camera aspect ratio.
 */
function surface_resized() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    surface.width = surface.clientWidth * devicePixelRatio;
    surface.height = surface.clientHeight * devicePixelRatio;
    camera.resized(surface.width, surface.height);
}

/**
 * Handles mouse movement over the surface.
 * @param {MouseEvent} e - The mouse event object.
 */
function surface_mousemove(e) {
    input['x'] += e.movementX;
    input['y'] += e.movementY;
}

/**
 * Handles mouse button press on the surface.
 * Toggles camera control and manages recording state.
 */
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
            nextStartTime = currentSection.endTime;
            currentSection = null;
        }
    }
}

/**
 * Handles changes to the scale range input.
 * Updates the camera scale and UI tooltip.
 */
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

/**
 * Updates the text content of UI text to reflect current parameter values.
 */
function update_parameter_tooltips() {
    range_scale_text.textContent = parseFloat(1.0 / camera.scale).toFixed(7);
    range_epsilon_text.textContent = parseFloat(1.0 / epsilon).toFixed(0);
    range_max_iterations_text.textContent = parseFloat(max_iter).toFixed(1);
    range_power_text.textContent = parseFloat(power).toFixed(0);
    range_bailout_text.textContent = parseFloat(bailout).toFixed(2);
}

/**
 * Resets the user settings to default values.
 * Resets camera position, rotation, and UI elements to their default states.
 */
function reset_user() {
    camera.setPosition(0, -3, 0);
    camera.setRotation(-90, 180);

    range_scale.value = 0.5;
    range_epsilon.value = 0.1;
    range_max_iterations.value = 0.5;
    range_power.value =  11/14;
    range_bailout.value = 0;

    color_near.value = "#7f1e5d"; 
    color_far.value = "#e5974d"; 
}

/**
 * Handles keydown events for the document.
 * Manages recording state and other key-based interactions.
 * @param {KeyboardEvent} e - The keyboard event object.
 */
function keydown(e) {
    input[e.code] = true;

    // start recording
    if(e.code === "KeyR" && !isRecording) {
        isRecording = true;
        pathData = [];
        currentSection = {
            startTime: 0,
            endTime: 0,
            camera: [],
            parameters: []
        };
        renderRecordingState();
    }
    
    // stop recording
    else if(e.code === "KeyR" && isRecording) {

        // push last data
        if(currentSection) {
            pathData.push(currentSection);
            currentSection = null;
        }
        
        isRecording = false;
        renderVisualization();
        renderRecordingState();
    }
}

/**
 * Handles keyup events for the document.
 * Updates the input state based on the released key.
 * @param {KeyboardEvent} e - The keyboard event object.
 */
function keyup(e) {
    input[e.code] = false;
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region aux
//----------------------------------------------------------------------------------------------------------------------

/**
 * Converts a hex color string to an RGB object.
 * @param {string} hex - The hex color string.
 * @returns {{r: number, g: number, b: number} | null} RGB color object or null if invalid.
 */
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Sets up uniform buffers for camera and parameters.
 */
function setup_uniforms() {
    uniforms_camera = new Float32Array(16); 
    uniforms_parameters = new Float32Array(12);
    update_uniforms();
}

/**
 * Updates the uniform buffers with current camera and parameter data.
 */
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

        let nearColorHex = hexToRgb(color_near.value);
        let farColorHex = hexToRgb(color_far.value);
        let nearColor = vec3.fromValues(nearColorHex.r/255, nearColorHex.g/255, nearColorHex.b/255);
        let farColor = vec3.fromValues(farColorHex.r/255, farColorHex.g/255, farColorHex.b/255);
        uniforms_parameters.set(nearColor, 4);
        uniforms_parameters.set(farColor, 8);
        state_parameters = 2;
    }
}

/**
 * Uploads the updated uniforms to the GPU.
 */
function upload_uniforms() {
    device.queue.writeBuffer(uniforms_camera_buffer, 0, uniforms_camera);
    if(state_parameters == 2) {
        device.queue.writeBuffer(uniforms_parameters_buffer, 0, uniforms_parameters);
        state_parameters = 0;
    }
}

/**
 * Resets mouse movement accumulation.
 */
function reset_mouse_accumulation() {
    input['x'] = 0;
    input['y'] = 0;
}


/**
 * Computes the Signed Distance Function (SDF) for the Mandelbulb fractal at a given position.
 * @param {Float32Array} pos - The position to compute the SDF at.
 * @returns {number} The computed distance.
 */
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

/**
 * Performs ray marching to compute the distance from a ray origin to the Mandelbulb fractal surface.
 * @param {Float32Array} ray_origin - The origin of the ray.
 * @param {Float32Array} ray_dir - The direction of the ray.
 * @returns {number} The distance from the ray origin to the fractal surface.
 */
function ray_marching(ray_origin, ray_dir) {
    var d = mandelbulb_sdf(ray_origin);
    var pos = vec3.add(ray_origin, vec3.mulScalar(ray_dir, d));
    var distance = d;
    var steps = 1;

    var epsilon = uniforms_parameters[0];

    while(distance < MAX_RAY_LENGTH && d > epsilon) {
        d = mandelbulb_sdf(pos);
        vec3.add(pos, vec3.mulScalar(ray_dir, d), pos);
        distance += d;
        steps++;
    }

    return (isNaN(distance) || distance <= 0) ? 0.0000001 : distance;
}

/**
 * Adapts camera and rendering parameters based on the distance to the fractal surface.
 */
function adapt() {
    // distance to fractal surface
    var distance = ray_marching(Float32Array.from(camera.position()), Float32Array.from(camera.forward()));
    
    // parameters (manually tweaked)
    camera.scale = Math.max(1.0 / MAX_SCALE, Math.pow(1.0 / distance, 1.2) * (1.0 / (parseFloat(range_scale.value) + 0.0000001)));
    epsilon = MIN_EPSILON + Math.max(Math.pow(distance, 0.9) * 15 * (parseFloat(1.0 - range_epsilon.value) * 0.0001), 0);
    max_iter = Math.min(MAX_ITER, MIN_ITER + Math.log10(2.0 / distance) * 7 * parseFloat(range_max_iterations.value));

    power = parseInt(MIN_POWER + (MAX_POWER - MIN_POWER - 1) * parseFloat(range_power.value));
    bailout = MIN_BAILOUT + (MAX_BAILOUT - MIN_BAILOUT) * parseFloat(range_bailout.value);
    
    // notify parameters changed
    state_parameters = 1;
    update_parameter_tooltips();
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region D3 visualiztion
//----------------------------------------------------------------------------------------------------------------------

// Margins and dimensions for the D3 visualization
const margin = { top: 40, right: 200, bottom: 40, left: 60 },
    width = 1100 - margin.left - margin.right,
    height = 200 - margin.top - margin.bottom;

/**
 * Renders the visualization using D3.
 */
function renderVisualization() {
    d3.select("#visualization").selectAll("*").remove();

    const data = preprocessData();

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
        .attr("y", height + margin.top)
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
        .attr("x", -margin.top + 50)
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
        .attr("stroke", "#E5974D")
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
                .text("max iter: " + Number(d.max_iter).toFixed(2))
                .attr("x", textX)
                .attr("dy", "1.2em")
            .append("tspan")
                .text("power: " + Number(d.power).toFixed(0))
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

/**
 * Renders the state of recording in the visualization.
 */
function renderRecordingState() {
    const svg = d3.select("#visualization").select("svg");

    svg.select("#recording-state").remove();

    const state = svg.select("g").append("g")
        .attr("id", "recording-state")
        .attr("transform", `translate(${width + margin.right/2}, ${height + margin.bottom - 120})`);

    state.append("circle")
        .attr("r", 15)
        .attr("stroke", "white")
        .attr("fill", isRecording ? "#CD2693" : "none");

    const text = state.append("text")
        .attr("text-anchor", "middle")
        //.attr("aligment-baseline", "middle")
        .html("")
            .attr("x", 0)
            .attr("y", 50)
            .style("font-size", "12px")
            .attr("fill", "white")
            .style("opacity", 1)
            .append("tspan")
                .text("press 'R'")
                .attr("x", 0)
                .attr("dy", 0)
            .append("tspan")
                .text(isRecording ? "to stop" : "to record")
                .attr("x", 0)
                .attr("dy", "1.2em")
}

/**
 * Preprocesses data for D3 visualization.
 * @returns {Array} The preprocessed data array.
 */
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

/**
 * Adjusts camera and rendering parameters based on the selected data point.
 * @param {Object} data - Data point containing the parameters to jump to.
 */
function jumpTo(data) {

    camera.setPosition(data.pos[0], data.pos[1], data.pos[2]);
    camera.setRotation(data.rot[0], data.rot[2]);

    uniforms_parameters[0] = data.epsilon;
    uniforms_parameters[1] = data.max_iter;
    uniforms_parameters[2] = data.power;
    uniforms_parameters[3] = data.bailout;
}

/**
 * Calculates the distance to the fractal bulb.
 * @param {Array} pos - Position array [x, y, z].
 * @returns {number} The calculated distance.
 */
function distanceToBulb(pos) {
    return Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
}

/**
 * Determines the line spacing for the D3 visualization based on epsilon.
 * @param {number} epsilon - The epsilon value used for line spacing.
 * @returns {string} The dash array string for SVG path.
 */
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