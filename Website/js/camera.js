class Camera {
    constructor(screenWidth, screenHeight) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.panX = 0;
        this.panY = 0;
        this.zoomLevel = 1.0;
        this.minZoom = 0.2;
        this.maxZoom = 5.0;
        this.zoomStep = 0.1;
        this.isPanning = false;
        this.lastMousePos = null;
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldPos) {
        const screenX = (worldPos[0] * this.zoomLevel) + this.panX;
        const screenY = (worldPos[1] * this.zoomLevel) + this.panY;
        return [screenX, screenY];
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenPos) {
        const worldX = (screenPos[0] - this.panX) / this.zoomLevel;
        const worldY = (screenPos[1] - this.panY) / this.zoomLevel;
        return [worldX, worldY];
    }

    // Start panning
    startPan(mousePos) {
        this.isPanning = true;
        this.lastMousePos = mousePos;
    }

    // Update panning
    pan(mousePos) {
        if (!this.isPanning || !this.lastMousePos) return;
        
        const deltaX = mousePos[0] - this.lastMousePos[0];
        const deltaY = mousePos[1] - this.lastMousePos[1];
        
        this.panX += deltaX;
        this.panY += deltaY;
        
        this.lastMousePos = mousePos;
    }

    // Stop panning
    stopPan() {
        this.isPanning = false;
        this.lastMousePos = null;
    }

    // Zoom at the specific screen position
    zoomAt(delta, centerScreenPos) {
        const centerWorldBefore = this.screenToWorld(centerScreenPos);
        
        // Apply zoom
        if (delta > 0) {
            this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomStep);
        } else {
            this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomStep);
        }
        
        // Adjust pan to keep the point under the mouse in the same position
        const centerWorldAfter = this.screenToWorld(centerScreenPos);
        this.panX += (centerWorldAfter[0] - centerWorldBefore[0]) * this.zoomLevel;
        this.panY += (centerWorldAfter[1] - centerWorldBefore[1]) * this.zoomLevel;
    }

    // Reset the camera to initial state
    reset() {
        this.panX = this.screenWidth / 2;
        this.panY = this.screenHeight / 2;
        this.zoomLevel = 1.0;
    }
} 