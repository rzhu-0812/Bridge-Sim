document.addEventListener('DOMContentLoaded', () => {
    const state = {
        joints: [],
        beams: [],
        calculatedReactions: {},
        currentTool: 'joint',
        selectedJointIdx: -1,
        selectedJointForLoadIdx: -1,
        needsRecalc: false,
        calculationDone: false,
        calculationSuccess: false,
        lastFailureReason: "System ready. Start building or load a structure.",
        problematicJointIndices: [],
        showGrid: true,
        showForces: true,
        showReactions: true,
        showHelp: false,
        showTooltip: true,
        hoverBeamIdx: -1,
        mouseScreenPos: [0, 0],
        mouseWorldPos: [0, 0]
    };

    const canvas = document.getElementById('simulation-canvas');    
    const camera = new Camera(canvas.width, canvas.height);
    camera.reset();
    
    const renderer = new Renderer(canvas, camera);
    
    const inputHandler = new InputHandler(state, camera, renderer);
    
    inputHandler.setTool('joint');
    
    document.getElementById('grid-toggle').classList.add('bg-primary', 'text-white');
    document.getElementById('forces-toggle').classList.add('bg-primary', 'text-white');
    document.getElementById('reactions-toggle').classList.add('bg-primary', 'text-white');
    document.getElementById('tooltip-toggle').classList.add('bg-primary', 'text-white');
    
    function resizeCanvas() {
        renderer.updateCanvasSize();
    }
    
    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);
    
    function animate() {
        if (state.needsRecalc) {
            for (const joint of state.joints) {
                joint.problematic = false;
            }
            
            const result = calculateForces(state.joints, state.beams);
            
            state.calculationDone = true;
            state.calculationSuccess = result.success;
            state.lastFailureReason = result.message;
            state.calculatedReactions = result.reactions || {};
            
            if (result.problematicJoints && result.problematicJoints.length > 0) {
                for (const jointIdx of result.problematicJoints) {
                    if (jointIdx >= 0 && jointIdx < state.joints.length) {
                        state.joints[jointIdx].problematic = true;
                    }
                }
            }
            
            const statusEl = document.getElementById('calculation-status');
            statusEl.textContent = result.message;
            
            statusEl.className = 'mt-2 text-sm ' + (result.success ? 'text-green-600' : 'text-red-600');
            
            state.needsRecalc = false;
        }
        
        document.getElementById('joint-count').textContent = state.joints.length;
        document.getElementById('beam-count').textContent = state.beams.length;
        
        renderer.drawAll(state);
        
        renderer.updateTooltip(state);
        
        requestAnimationFrame(animate);
    }
    
    animate();
}); 