class Renderer {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = camera;
        this.blinkInterval = 250;
        this.lastBlinkTime = 0;
        this.showBlink = false;
    }

    updateCanvasSize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.camera.screenWidth = this.canvas.width;
        this.camera.screenHeight = this.canvas.height;
    }

    drawGrid(showGrid) {
        if (!showGrid) return;

        const ctx = this.ctx;
        
        const [startX, startY] = this.camera.screenToWorld([0, 0]);
        const [endX, endY] = this.camera.screenToWorld([this.canvas.width, this.canvas.height]);
        
        const gridOffsetX = Math.floor(startX / GRID_SIZE) * GRID_SIZE;
        const gridOffsetY = Math.floor(startY / GRID_SIZE) * GRID_SIZE;
        
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        
        for (let x = gridOffsetX; x <= endX; x += GRID_SIZE) {
            const [screenX] = this.camera.worldToScreen([x, 0]);
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            ctx.stroke();
        }
        
        for (let y = gridOffsetY; y <= endY; y += GRID_SIZE) {
            const [, screenY] = this.camera.worldToScreen([0, y]);
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
            ctx.stroke();
        }
    }
    
    drawBeams(beams, joints, showForces) {
        for (const beam of beams) {
            beam.draw(this.ctx, joints, (worldPos) => this.camera.worldToScreen(worldPos), showForces);
        }
    }
    
    drawTempBeam(startJoint, mouseWorldPos) {
        if (!startJoint) return;
        
        const [screenX1, screenY1] = this.camera.worldToScreen([startJoint.x, startJoint.y]);
        const [screenX2, screenY2] = this.camera.worldToScreen(mouseWorldPos);
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenX1, screenY1);
        this.ctx.lineTo(screenX2, screenY2);
        this.ctx.strokeStyle = TEMP_BEAM_COLOR;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawJoints(joints, selectedJointIdx, selectedForLoadJointIdx) {
        const currentTime = Date.now();
        if (currentTime - this.lastBlinkTime > this.blinkInterval) {
            this.showBlink = !this.showBlink;
            this.lastBlinkTime = currentTime;
        }
        
        for (let i = 0; i < joints.length; i++) {
            const joint = joints[i];
            const isProblematic = joint.problematic && !this.showBlink;
            
            if (isProblematic) joint.problematic = false;
            
            joint.draw(this.ctx, 
                (worldPos) => this.camera.worldToScreen(worldPos), 
                i === selectedForLoadJointIdx
            );
            
            if (isProblematic) joint.problematic = true;
        }
        
        if (selectedJointIdx >= 0 && selectedJointIdx < joints.length) {
            const joint = joints[selectedJointIdx];
            const [screenX, screenY] = this.camera.worldToScreen([joint.x, joint.y]);
            
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, HIGHLIGHT_RADIUS, 0, Math.PI * 2);
            this.ctx.strokeStyle = SELECTION_COLOR;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    drawReactions(joints, reactions, showReactions) {
        if (!showReactions || !reactions) return;
        
        this.ctx.font = '14px sans-serif';
        this.ctx.fillStyle = REACTION_TEXT_COLOR;
        this.ctx.textBaseline = 'bottom';
        this.ctx.textAlign = 'left';
        
        for (const [jointIdxStr, reactionForces] of Object.entries(reactions)) {
            const jointIdx = parseInt(jointIdxStr);
            if (jointIdx >= 0 && jointIdx < joints.length) {
                const joint = joints[jointIdx];
                const [screenX, screenY] = this.camera.worldToScreen([joint.x, joint.y]);
                
                const [rx, ry] = reactionForces;
                const textY = screenY + JOINT_RADIUS + 5;
                
                if (Math.abs(rx) > FLOAT_TOLERANCE) {
                    this.ctx.fillText(`Rx = ${rx.toFixed(0)} N`, screenX + JOINT_RADIUS + 5, textY);
                }
                
                if (Math.abs(ry) > FLOAT_TOLERANCE) {
                    this.ctx.fillText(`Ry = ${ry.toFixed(0)} N`, screenX + JOINT_RADIUS + 5, textY + 16);
                }
            }
        }
    }
    
    drawHoveredBeamInfo(beams, joints, hoverBeamIdx) {
        if (hoverBeamIdx < 0 || hoverBeamIdx >= beams.length) return;
        
        const beam = beams[hoverBeamIdx];
        if (beam.joint1Idx >= joints.length || beam.joint2Idx >= joints.length) return;
        
        const joint1 = joints[beam.joint1Idx];
        const joint2 = joints[beam.joint2Idx];
        
        const [screenX1, screenY1] = this.camera.worldToScreen([joint1.x, joint1.y]);
        const [screenX2, screenY2] = this.camera.worldToScreen([joint2.x, joint2.y]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenX1, screenY1);
        this.ctx.lineTo(screenX2, screenY2);
        this.ctx.strokeStyle = HIGHLIGHT_COLOR;
        this.ctx.lineWidth = 8;
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }
    
    drawAll(state) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid(state.showGrid);
        this.drawBeams(state.beams, state.joints, state.showForces);
        
        if (state.currentTool === "beam" && state.selectedJointIdx >= 0) {
            this.drawTempBeam(
                state.joints[state.selectedJointIdx], 
                state.mouseWorldPos
            );
        }
        
        this.drawJoints(state.joints, state.selectedJointIdx, state.selectedJointForLoadIdx);
        this.drawReactions(state.joints, state.calculatedReactions, state.showReactions);
        this.drawHoveredBeamInfo(state.beams, state.joints, state.hoverBeamIdx);
    }
    
    updateTooltip(state) {
        const tooltip = document.getElementById('tooltip');
        
        if (state.showTooltip && state.hoverBeamIdx >= 0 && state.hoverBeamIdx < state.beams.length) {
            const beam = state.beams[state.hoverBeamIdx];
            const length = beam.getLength(state.joints).toFixed(2);
            const forceStr = Math.abs(beam.force) < FLOAT_TOLERANCE ? "0.0" : beam.force.toFixed(2);
            const stressStr = Math.abs(beam.stress) < FLOAT_TOLERANCE ? "0.0" : (beam.stress / 1e6).toFixed(2);
            const forceType = beam.force > 0 ? "Tension" : beam.force < 0 ? "Compression" : "None";
            
            tooltip.innerHTML = `
                <div class="font-medium">Beam ${state.hoverBeamIdx}</div>
                <div>Length: ${length} m</div>
                <div>Force: ${forceStr} N (${forceType})</div>
                <div>Stress: ${stressStr} MPa</div>
            `;
            
            tooltip.style.left = (state.mouseScreenPos[0] + 15) + 'px';
            tooltip.style.top = (state.mouseScreenPos[1] + 15) + 'px';
            tooltip.classList.remove('hidden');
        } else {
            tooltip.classList.add('hidden');
        }
    }
} 