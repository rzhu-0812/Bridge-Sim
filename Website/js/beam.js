class Beam {
    constructor(joint1Idx, joint2Idx) {
        this.joint1Idx = joint1Idx;
        this.joint2Idx = joint2Idx;
        this.force = 0.0;
        this.crossSectionalArea = BEAM_DEFAULT_AREA;
        this.stress = 0.0;
    }

    draw(ctx, joints, worldToScreenFunc, showForces) {
        if (this.joint1Idx >= joints.length || this.joint2Idx >= joints.length) {
            return;
        }

        const joint1 = joints[this.joint1Idx];
        const joint2 = joints[this.joint2Idx];
        const [screenX1, screenY1] = worldToScreenFunc([joint1.x, joint1.y]);
        const [screenX2, screenY2] = worldToScreenFunc([joint2.x, joint2.y]);

        let color = BEAM_COLOR;
        
        // If showing forces and beam has a force, use a color gradient based on tension/compression
        if (showForces && Math.abs(this.force) > FLOAT_TOLERANCE) {
            const ratio = Math.min(Math.abs(this.force) / MAX_FORCE_VIS, 1.0);
            if (this.force > 0) {
                // Tension - show in red
                const intensity = Math.floor(255 * (1 - ratio));
                color = `rgb(255, ${intensity}, ${intensity})`;
            } else {
                // Compression - show in blue
                const intensity = Math.floor(255 * (1 - ratio));
                color = `rgb(${intensity}, ${intensity}, 255)`;
            }
        }

        // Draw the beam
        ctx.beginPath();
        ctx.moveTo(screenX1, screenY1);
        ctx.lineTo(screenX2, screenY2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    getLength(joints) {
        if (this.joint1Idx >= joints.length || this.joint2Idx >= joints.length) {
            return 0;
        }
        
        const joint1 = joints[this.joint1Idx];
        const joint2 = joints[this.joint2Idx];
        
        return Math.hypot(joint1.x - joint2.x, joint1.y - joint2.y);
    }

    getAngleRadRelativeTo(jointIdx, joints) {
        if (this.joint1Idx >= joints.length || this.joint2Idx >= joints.length) {
            return null;
        }
        
        let startJoint, endJoint;
        
        if (this.joint1Idx === jointIdx) {
            startJoint = joints[this.joint1Idx];
            endJoint = joints[this.joint2Idx];
        } else if (this.joint2Idx === jointIdx) {
            startJoint = joints[this.joint2Idx];
            endJoint = joints[this.joint1Idx];
        } else {
            return null;
        }
        
        return Math.atan2(endJoint.y - startJoint.y, endJoint.x - startJoint.x);
    }
} 