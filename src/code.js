//#region init
//----------------------------------------------------------------------------------------------------------------------

function init() {
    init_webgpu().then(() => {console.log("webgpu initialized!");});
}

async function init_webgpu() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = document.getElementById('surface').getContext('webgpu');
    const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: swapChainFormat,
    });

    // init camera
    /*const camera = new ArcballCamera({position: [0, 0, 5]});

    const cameraBuffer = device.createBuffer({
        size: 64, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const cameraBindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
        }],
    });
    
    const cameraBindGroup = device.createBindGroup({
        layout: cameraBindGroupLayout,
        entries: [{
            binding: 0,
            resource: {
                buffer: cameraBuffer,
            },
        }],
    });*/

    const canvas = document.getElementById('surface');
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    console.log("width: " + canvasWidth);
    console.log("height: " + canvasHeight);

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
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
                format: swapChainFormat,
            }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    function frame() {
        // udpate camera
        //device.queue.writeBuffer(cameraBuffer, 0, camera.view);

        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
    
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        };
    
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        //passEncoder.setBindGroup(0, cameraBindGroup);
        passEncoder.draw(3);
        passEncoder.end();
    
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

window.onload = init;
//----------------------------------------------------------------------------------------------------------------------
//#endregion
