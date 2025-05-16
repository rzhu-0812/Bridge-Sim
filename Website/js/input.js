class InputHandler {
    constructor(state, camera, renderer) {
        this.state = state;
        this.camera = camera;
        this.renderer = renderer;
        this.dragMode = null;
        this.isSpaceDown = false;
        this.initialize();
    }

    initialize() {
        const canvas = document.getElementById('simulation-canvas');
        const container = document.getElementById('sim-container');
        
        canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        document.getElementById('joint-button').addEventListener('click', () => this.setTool('joint'));
        document.getElementById('beam-button').addEventListener('click', () => this.setTool('beam'));
        document.getElementById('anchor-button').addEventListener('click', () => this.setTool('anchor'));
        document.getElementById('load-button').addEventListener('click', () => this.setTool('load'));
        
        document.getElementById('grid-toggle').addEventListener('click', () => this.toggleOption('showGrid'));
        document.getElementById('forces-toggle').addEventListener('click', () => this.toggleOption('showForces'));
        document.getElementById('reactions-toggle').addEventListener('click', () => this.toggleOption('showReactions'));
        document.getElementById('tooltip-toggle').addEventListener('click', () => this.toggleOption('showTooltip'));
        
        document.getElementById('zoom-in-button').addEventListener('click', () => this.zoomView(1));
        document.getElementById('zoom-out-button').addEventListener('click', () => this.zoomView(-1));
        document.getElementById('reset-view-button').addEventListener('click', () => this.resetView());
        
        document.getElementById('help-button').addEventListener('click', () => this.toggleHelp());
        document.getElementById('close-help-button').addEventListener('click', () => this.toggleHelp());
        document.getElementById('calculate-button').addEventListener('click', () => this.calculateForces());
        
        document.getElementById('fx-plus-button').addEventListener('click', () => this.adjustLoad(LOAD_INCREMENT_STEP, 0));
        document.getElementById('fx-minus-button').addEventListener('click', () => this.adjustLoad(-LOAD_INCREMENT_STEP, 0));
        document.getElementById('fy-plus-button').addEventListener('click', () => this.adjustLoad(0, LOAD_INCREMENT_STEP));
        document.getElementById('fy-minus-button').addEventListener('click', () => this.adjustLoad(0, -LOAD_INCREMENT_STEP));
        document.getElementById('clear-load-button').addEventListener('click', () => this.clearLoad());
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        window.addEventListener('resize', this.handleResize.bind(this));
        this.handleResize();
    }
    
    handleMouseDown(event) {
        const rect = event.target.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const mouseScreenPos = [mouseX, mouseY];
        const mouseWorldPos = this.camera.screenToWorld(mouseScreenPos);
        
        this.state.mouseScreenPos = mouseScreenPos;
        this.state.mouseWorldPos = mouseWorldPos;
        
        if (event.button === 1 || (this.isSpaceDown && event.button === 0)) {
            this.dragMode = 'pan';
            this.camera.startPan(mouseScreenPos);
            return;
        }
        
        if (event.button === 0) {
            const clickedJointIdx = this.findJointUnderCursor(mouseWorldPos);
            
            switch (this.state.currentTool) {
                case 'joint':
                    if (clickedJointIdx === -1) {
                        this.createNewJoint(mouseWorldPos[0], mouseWorldPos[1]);
                    } else {
                        this.state.selectedJointIdx = clickedJointIdx;
                    }
                    break;
                    
                case 'beam':
                    if (clickedJointIdx !== -1) {
                        if (this.state.selectedJointIdx === -1) {
                            this.state.selectedJointIdx = clickedJointIdx;
                        } else if (this.state.selectedJointIdx !== clickedJointIdx) {
                            this.createNewBeam(this.state.selectedJointIdx, clickedJointIdx);
                            this.state.selectedJointIdx = -1;
                        }
                    }
                    break;
                    
                case 'anchor':
                    if (clickedJointIdx !== -1) {
                        // Toggle anchor state
                        this.state.joints[clickedJointIdx].isAnchor = !this.state.joints[clickedJointIdx].isAnchor;
                        this.state.needsRecalc = true;
                    }
                    break;
                    
                case 'load':
                    if (clickedJointIdx !== -1) {
                        this.state.selectedJointForLoadIdx = clickedJointIdx;
                        this.updateLoadControlButtons();
                    }
                    break;
                    
                default:
                    if (clickedJointIdx !== -1) {
                        this.state.selectedJointIdx = clickedJointIdx;
                    } else {
                        // Check for beam selection
                        this.updateBeamUnderCursor(mouseWorldPos);
                    }
            }
        }
    }
    
    handleMouseMove(event) {
        const canvas = document.getElementById('simulation-canvas');
        const rect = canvas.getBoundingClientRect();
        const isInCanvas = (
            event.clientX >= rect.left && 
            event.clientX <= rect.right && 
            event.clientY >= rect.top && 
            event.clientY <= rect.bottom
        );
        
        if (isInCanvas) {
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const mouseScreenPos = [mouseX, mouseY];
            const mouseWorldPos = this.camera.screenToWorld(mouseScreenPos);
            
            this.state.mouseScreenPos = mouseScreenPos;
            this.state.mouseWorldPos = mouseWorldPos;
            
            if (this.dragMode === 'pan') {
                this.camera.pan(mouseScreenPos);
            } else {
                this.updateBeamUnderCursor(mouseWorldPos);
            }
            
            // Update tooltip if hovering over a beam
            this.renderer.updateTooltip(this.state);
        }
    }
    
    handleMouseUp(event) {
        if (this.dragMode === 'pan') {
            this.camera.stopPan();
        }
        this.dragMode = null;
    }
    
    handleWheel(event) {
        event.preventDefault();
        const delta = Math.sign(-event.deltaY);
        const rect = event.target.getBoundingClientRect();
        const mouseScreenPos = [
            event.clientX - rect.left,
            event.clientY - rect.top
        ];
        
        this.camera.zoomAt(delta, mouseScreenPos);
    }
    
    handleKeyDown(event) {
        if (event.code === 'Space') {
            this.isSpaceDown = true;
        } else if (event.code === 'Delete' || event.code === 'Backspace') {
            if (this.state.selectedJointIdx !== -1) {
                this.deleteSelectedJoint();
            }
        } else if (event.code === 'Escape') {
            // Cancel current operation
            if (this.state.currentTool === 'beam' && this.state.selectedJointIdx !== -1) {
                this.state.selectedJointIdx = -1;
            } else if (this.state.showHelp) {
                this.toggleHelp();
            }
        }
    }
    
    handleKeyUp(event) {
        if (event.code === 'Space') {
            this.isSpaceDown = false;
        }
    }
    
    handleResize() {
        this.renderer.updateCanvasSize();
    }
    
    findJointUnderCursor(worldPos) {
        const pickRadius = 10 / this.camera.zoomLevel; // 10 px in screen coordinates
        
        for (let i = this.state.joints.length - 1; i >= 0; i--) {
            const joint = this.state.joints[i];
            const dx = joint.x - worldPos[0];
            const dy = joint.y - worldPos[1];
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= pickRadius * pickRadius) {
                return i;
            }
        }
        
        return -1;
    }
    
    updateBeamUnderCursor(worldPos) {
        const pickRadius = 8 / this.camera.zoomLevel; // 8 px in screen coordinates
        let closestBeamIdx = -1;
        let minDist = pickRadius;
        
        for (let i = 0; i < this.state.beams.length; i++) {
            const beam = this.state.beams[i];
            if (beam.joint1Idx >= this.state.joints.length || beam.joint2Idx >= this.state.joints.length) {
                continue;
            }
            
            const j1 = this.state.joints[beam.joint1Idx];
            const j2 = this.state.joints[beam.joint2Idx];
            
            // Calculate the distance from the point to the line segment
            const dx = j2.x - j1.x;
            const dy = j2.y - j1.y;
            const lenSq = dx * dx + dy * dy;
            
            if (lenSq === 0) continue; // Zero-length beam
            
            // Calculate the projection ratio
            const t = Math.max(0, Math.min(1, 
                ((worldPos[0] - j1.x) * dx + (worldPos[1] - j1.y) * dy) / lenSq
            ));
            
            // Calculate the closest point on the line segment
            const closestX = j1.x + t * dx;
            const closestY = j1.y + t * dy;
            
            // Calculate the distance
            const distToBeam = Math.hypot(worldPos[0] - closestX, worldPos[1] - closestY);
            
            if (distToBeam < minDist) {
                minDist = distToBeam;
                closestBeamIdx = i;
            }
        }
        
        this.state.hoverBeamIdx = closestBeamIdx;
    }
    
    createNewJoint(x, y) {
        const isAnchor = false;
        const newJoint = new Joint(x, y, isAnchor);
        this.state.joints.push(newJoint);
        this.state.selectedJointIdx = this.state.joints.length - 1;
        this.state.needsRecalc = true;
        this.updateCounters();
    }
    
    createNewBeam(joint1Idx, joint2Idx) {
        // Check if a beam already exists between these joints
        for (const beam of this.state.beams) {
            if ((beam.joint1Idx === joint1Idx && beam.joint2Idx === joint2Idx) ||
                (beam.joint1Idx === joint2Idx && beam.joint2Idx === joint1Idx)) {
                return;
            }
        }
        
        const newBeam = new Beam(joint1Idx, joint2Idx);
        this.state.beams.push(newBeam);
        this.state.needsRecalc = true;
        this.updateCounters();
    }
    
    deleteSelectedJoint() {
        if (this.state.selectedJointIdx === -1) return;
        
        // Remove all beams connected to this joint first
        this.state.beams = this.state.beams.filter(beam => 
            beam.joint1Idx !== this.state.selectedJointIdx && 
            beam.joint2Idx !== this.state.selectedJointIdx
        );
        
        // Remove the joint
        this.state.joints.splice(this.state.selectedJointIdx, 1);
        
        // Update beam indices after joint removal
        for (const beam of this.state.beams) {
            if (beam.joint1Idx > this.state.selectedJointIdx) {
                beam.joint1Idx--;
            }
            if (beam.joint2Idx > this.state.selectedJointIdx) {
                beam.joint2Idx--;
            }
        }
        
        this.state.selectedJointIdx = -1;
        this.state.needsRecalc = true;
        this.updateCounters();
    }
    
    setTool(tool) {
        this.state.currentTool = tool;
        this.updateToolButtonStyles();
        
        // Update status message
        let statusMessage;
        switch (tool) {
            case 'joint':
                statusMessage = 'Click to place a joint';
                break;
            case 'beam':
                statusMessage = 'Select two joints to create a beam';
                break;
            case 'anchor':
                statusMessage = 'Click a joint to toggle it as an anchor';
                break;
            case 'load':
                statusMessage = 'Select a joint to apply load';
                break;
            default:
                statusMessage = 'Select a tool';
        }
        document.getElementById('status-message').textContent = statusMessage;
        
        // Clear selection when changing tools unless we're in beam mode with a selection
        if (!(tool === 'beam' && this.state.selectedJointIdx !== -1)) {
            this.state.selectedJointIdx = -1;
        }
        
        // Update selected joint info
        this.updateSelectedJointInfo();
    }
    
    updateToolButtonStyles() {
        // Remove active class from all tool buttons
        document.querySelectorAll('#joint-button, #beam-button, #anchor-button, #load-button')
            .forEach(button => {
                button.classList.remove('bg-primary', 'text-white');
            });
        
        // Add active class to current tool button
        const activeButtonId = `${this.state.currentTool}-button`;
        const activeButton = document.getElementById(activeButtonId);
        if (activeButton) {
            activeButton.classList.add('bg-primary', 'text-white');
        }
    }
    
    toggleOption(option) {
        this.state[option] = !this.state[option];
        
        // Update toggle button styles
        const buttonMap = {
            showGrid: 'grid-toggle',
            showForces: 'forces-toggle',
            showReactions: 'reactions-toggle',
            showTooltip: 'tooltip-toggle'
        };
        
        const buttonId = buttonMap[option];
        const button = document.getElementById(buttonId);
        
        if (button) {
            if (this.state[option]) {
                button.classList.add('bg-primary', 'text-white');
            } else {
                button.classList.remove('bg-primary', 'text-white');
                button.classList.add('bg-gray-100');
            }
        }
        
        // Trigger recalculation if forces or reactions visibility changed
        if (option === 'showForces' || option === 'showReactions') {
            this.state.needsRecalc = true;
        }
    }
    
    zoomView(delta) {
        const centerX = this.renderer.canvas.width / 2;
        const centerY = this.renderer.canvas.height / 2;
        this.camera.zoomAt(delta, [centerX, centerY]);
    }
    
    resetView() {
        this.camera.reset();
    }
    
    toggleHelp() {
        this.state.showHelp = !this.state.showHelp;
        const helpDialog = document.getElementById('help-dialog');
        
        if (this.state.showHelp) {
            helpDialog.classList.remove('hidden');
        } else {
            helpDialog.classList.add('hidden');
        }
    }
    
    calculateForces() {
        this.state.needsRecalc = true;
        
        // Reset problematic flags
        for (const joint of this.state.joints) {
            joint.problematic = false;
        }
        
        const result = calculateForces(this.state.joints, this.state.beams);
        
        this.state.calculationDone = true;
        this.state.calculationSuccess = result.success;
        this.state.lastFailureReason = result.message;
        this.state.calculatedReactions = result.reactions || {};
        
        // Mark problematic joints if any
        if (result.problematicJoints && result.problematicJoints.length > 0) {
            for (const jointIdx of result.problematicJoints) {
                if (jointIdx >= 0 && jointIdx < this.state.joints.length) {
                    this.state.joints[jointIdx].problematic = true;
                }
            }
        }
        
        // Update status message
        document.getElementById('status-message').textContent = result.message;
        document.getElementById('calculation-status').textContent = result.message;
        document.getElementById('calculation-status').className = result.success ? 'text-green-600' : 'text-red-600';
    }
    
    adjustLoad(dFx, dFy) {
        if (this.state.selectedJointForLoadIdx === -1) return;
        
        const joint = this.state.joints[this.state.selectedJointForLoadIdx];
        joint.load[0] += dFx;
        joint.load[1] += dFy;
        this.state.needsRecalc = true;
        
        // Update joint info in sidebar
        this.updateSelectedJointInfo();
    }
    
    clearLoad() {
        if (this.state.selectedJointForLoadIdx === -1) return;
        
        const joint = this.state.joints[this.state.selectedJointForLoadIdx];
        joint.load = [0, 0];
        this.state.needsRecalc = true;
        
        // Update joint info in sidebar
        this.updateSelectedJointInfo();
    }
    
    updateLoadControlButtons() {
        const loadButtons = [
            document.getElementById('fx-plus-button'),
            document.getElementById('fx-minus-button'),
            document.getElementById('fy-plus-button'),
            document.getElementById('fy-minus-button'),
            document.getElementById('clear-load-button')
        ];
        
        const enabled = this.state.selectedJointForLoadIdx !== -1;
        
        // Enable/disable load control buttons
        loadButtons.forEach(button => {
            if (button) {
                button.disabled = !enabled;
                
                if (enabled) {
                    button.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    button.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        });
        
        this.updateSelectedJointInfo();
    }
    
    updateSelectedJointInfo() {
        const infoDiv = document.getElementById('selected-joint-info');
        
        if (this.state.selectedJointForLoadIdx !== -1) {
            const joint = this.state.joints[this.state.selectedJointForLoadIdx];
            infoDiv.innerHTML = `
                <p>Joint ${this.state.selectedJointForLoadIdx}</p>
                <p>Position: (${joint.x.toFixed(1)}, ${joint.y.toFixed(1)})</p>
                <p>Type: ${joint.isAnchor ? 'Anchor' : 'Free'}</p>
                <p>Load Fx: ${joint.load[0].toFixed(1)} N</p>
                <p>Load Fy: ${joint.load[1].toFixed(1)} N</p>
            `;
        } else {
            infoDiv.innerHTML = `<p>No joint selected</p>`;
        }
    }
    
    updateCounters() {
        document.getElementById('joint-count').textContent = this.state.joints.length;
        document.getElementById('beam-count').textContent = this.state.beams.length;
    }
} 