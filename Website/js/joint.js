class Joint {
    constructor(x, y, isAnchor = false) {
        this.x = x;
        this.y = y;
        this.isAnchor = isAnchor;
        this.load = [0.0, 0.0]; // [fx, fy]
        this.problematic = false;
    }

    draw(ctx, worldToScreenFunc, isSelectedForLoad = false) {
        const [screenX, screenY] = worldToScreenFunc([this.x, this.y]);
        const color = this.isAnchor ? ANCHOR_COLOR : JOINT_COLOR;
        
        // Draw joint circle
        ctx.beginPath();
        ctx.arc(screenX, screenY, JOINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Draw anchor base if this is an anchor
        if (this.isAnchor) {
            const rectWidth = JOINT_RADIUS * 2;
            const rectHeight = JOINT_RADIUS;
            ctx.fillStyle = ANCHOR_COLOR;
            ctx.fillRect(screenX - JOINT_RADIUS, screenY + JOINT_RADIUS - 2, rectWidth, rectHeight);
        }
        
        // Draw selection highlight if selected for load
        if (isSelectedForLoad) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, HIGHLIGHT_RADIUS + 2, 0, Math.PI * 2);
            ctx.strokeStyle = SELECTED_FOR_LOAD_HIGHLIGHT_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        const [fx, fy] = this.load;
        const arrowScreenLen = 25;
        const textOffsetX = JOINT_RADIUS + 5;
        const textOffsetY = -JOINT_RADIUS - 8;
        
        // Draw vertical force arrow
        if (Math.abs(fy) > FLOAT_TOLERANCE) {
            const directionY = fy > 0 ? -1 : 1;
            const arrowStartY = (JOINT_RADIUS + 2) * directionY;
            const arrowEndY = arrowStartY + (arrowScreenLen * directionY);
            
            // Draw arrow line
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + arrowStartY);
            ctx.lineTo(screenX, screenY + arrowEndY);
            ctx.strokeStyle = LOAD_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw arrow tip
            const tipY = screenY + arrowEndY;
            ctx.beginPath();
            if (fy > 0) {
                ctx.moveTo(screenX, tipY - 3);
                ctx.lineTo(screenX - 4, tipY + 3);
                ctx.lineTo(screenX + 4, tipY + 3);
            } else {
                ctx.moveTo(screenX, tipY + 3);
                ctx.lineTo(screenX - 4, tipY - 3);
                ctx.lineTo(screenX + 4, tipY - 3);
            }
            ctx.fillStyle = LOAD_COLOR;
            ctx.fill();
            
            // Draw force text
            const loadText = `${Math.abs(fy).toFixed(0)} N ${fy > 0 ? '↑' : '↓'}`;
            ctx.font = '14px Arial';
            ctx.fillStyle = LOAD_TEXT_COLOR;
            ctx.textBaseline = 'bottom';
            
            const textPosY = fy > 0 ? screenY + textOffsetY - 10 : screenY + textOffsetY;
            ctx.fillText(loadText, screenX + textOffsetX, textPosY);
        }
        
        // Draw horizontal force arrow
        if (Math.abs(fx) > FLOAT_TOLERANCE) {
            const directionX = fx > 0 ? -1 : 1;
            const arrowStartX = (JOINT_RADIUS + 2) * directionX;
            const arrowEndX = arrowStartX + (arrowScreenLen * directionX);
            
            // Draw arrow line
            ctx.beginPath();
            ctx.moveTo(screenX + arrowStartX, screenY);
            ctx.lineTo(screenX + arrowEndX, screenY);
            ctx.strokeStyle = LOAD_COLOR;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw arrow tip
            const tipX = screenX + arrowEndX;
            ctx.beginPath();
            if (fx > 0) {
                ctx.moveTo(tipX - 3, screenY);
                ctx.lineTo(tipX + 3, screenY - 4);
                ctx.lineTo(tipX + 3, screenY + 4);
            } else {
                ctx.moveTo(tipX + 3, screenY);
                ctx.lineTo(tipX - 3, screenY - 4);
                ctx.lineTo(tipX - 3, screenY + 4);
            }
            ctx.fillStyle = LOAD_COLOR;
            ctx.fill();
            
            // Draw force text
            const loadText = `${Math.abs(fx).toFixed(0)} N ${fx > 0 ? '→' : '←'}`;
            ctx.font = '14px Arial';
            ctx.fillStyle = LOAD_TEXT_COLOR;
            ctx.textBaseline = 'bottom';
            
            let textAnchorX;
            if (Math.abs(fy) > FLOAT_TOLERANCE && fy < 0) {
                textAnchorX = screenX + textOffsetX + 60;
            } else if (fx > 0) {
                textAnchorX = screenX + textOffsetX;
            } else {
                textAnchorX = screenX - textOffsetX - 60;
            }
            
            if (fx > 0) {
                ctx.textAlign = 'left';
                ctx.fillText(loadText, textAnchorX, screenY + textOffsetY);
            } else {
                ctx.textAlign = 'right';
                ctx.fillText(loadText, textAnchorX, screenY + textOffsetY);
            }
            ctx.textAlign = 'left'; // Reset text alignment
        }
        
        // Draw problematic highlight (blinking effect handled in renderer)
        if (this.problematic) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, HIGHLIGHT_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = HIGHLIGHT_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
} 