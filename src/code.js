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
    } else {
        document.exitPointerLock();
    }
}


function keydown(e) {
    input[e.code] = true;
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
        if(e * e * e < 0.0000001) {
            console.log("machine precision biiiiiiiitch");
        }
        e = Math.max(e * e * e, 0.0000001);
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
