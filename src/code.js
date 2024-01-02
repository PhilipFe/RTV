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

    
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: triangle_vert,
            }),
            entryPoint: 'main',
        },
        fragment: {
            module: device.createShaderModule({
                code: triangle_frag,
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
        passEncoder.draw(3);
        passEncoder.end();
    
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

//----------------------------------------------------------------------------------------------------------------------
//#endregion
