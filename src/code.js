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
let pathData = [];
let isRecording = false;
let currentSection = null;
let lastTime = 0;
const saveTime = 1000; // save data every second

// aux
let ts;
let dt;
let camera_enabled = false;
let state_parameters = 1; // 0 - default | 1 - changed | 2 - awaiting upload to gpu

// other
let input = {};
let camera;

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
            lastTime = currentTime;
        }

    }
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
                startTime: performance.now(),
                path: [],
                parameters: {
                    epsilon: uniforms_parameters[0],
                    max_iter: uniforms_parameters[1],
                    power: uniforms_parameters[2],
                    bailout: uniforms_parameters[3]
                }
            };
        }
    } else {
        document.exitPointerLock();

        // save recorded section
        if (isRecording && currentSection) {
            currentSection.endTime = performance.now();
            pathData.push(currentSection);
            console.log("Section Recorded: ", currentSection);
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
        /*currentSection = {
            time: performance.now(),
            path: [],
            parameters: {
                epsilon: uniforms_parameters[0],
                max_iter: uniforms_parameters[1],
                power: uniforms_parameters[2],
                bailout: uniforms_parameters[3]
            }
        };
        startTime = currentSection.time;*/
    }
    
    // stop recording
    else if(e.code === "KeyR" && isRecording) {
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


function reset_mouse_accumulation() {
    input['x'] = 0;
    input['y'] = 0;
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion

//#region D3 visualiztion
//----------------------------------------------------------------------------------------------------------------------
function renderVisualization() {
    d3.select("#visualization").selectAll("*").remove();

    const data = preprocessData();
    const width = 400, height = 400;

    const svg = d3.select("#visualization").append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background-color", "white");

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.y))
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);
    
    //console.log("Y range:", d3.extent(data, d => d.y));
    //console.log("Sample X values:", data.slice(0, 10).map(d => d.x));
    //console.log("data: ", data);

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    /*svg.append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", 50)
        .style("fill", "blue");*/
}

function preprocessData() {
    let data = [];
    let time = 0;

    pathData.forEach(section => {
        section.path.forEach((pos, i) => {
            data.push({
                x: time + i,
                y: distanceToBulb(pos)
            });
            console.log("position: ", pos);
        });
        let duration = (section.endTime - section.startTime) / 1000
        time += Math.round(duration);
    });

    return data;
}

function distanceToBulb(pos) {
    return Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion