// Isometric Projection Math & Coordinate Utilities
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const TILE_DEPTH = 16;

class Isometric {
  // Convert World Grid Coordinates (x, y, z) to 2D Isometric Coordinates
  static worldToIso(x, y, z = 0) {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2) - (z * TILE_HEIGHT);
    return { x: isoX, y: isoY };
  }

  // Convert Canvas Screen Pixel Coordinates to World Grid (x, y)
  static screenToWorld(screenX, screenY, camera, canvasWidth, canvasHeight) {
    const unscaledX = (screenX - canvasWidth / 2) / camera.zoom + camera.x;
    const unscaledY = (screenY - canvasHeight / 2) / camera.zoom + camera.y;

    const termA = unscaledX / (TILE_WIDTH / 2);
    const termB = unscaledY / (TILE_HEIGHT / 2);

    const worldX = (termA + termB) / 2;
    const worldY = (termB - termA) / 2;

    return { x: worldX, y: worldY };
  }

  // Convert World to Canvas Screen Pixel Coordinates
  static worldToScreen(x, y, z, camera, canvasWidth, canvasHeight) {
    const iso = this.worldToIso(x, y, z);
    const shakeX = (camera && camera.shakeOffsetX) ? camera.shakeOffsetX : 0;
    const shakeY = (camera && camera.shakeOffsetY) ? camera.shakeOffsetY : 0;
    const screenX = (iso.x - camera.x) * camera.zoom + canvasWidth / 2 + shakeX;
    const screenY = (iso.y - camera.y) * camera.zoom + canvasHeight / 2 + shakeY;
    return { x: screenX, y: screenY };
  }

  // Calculate rendering depth for sorting (Painter's algorithm)
  static getDepth(x, y, z = 0, priority = 0) {
    // Entities at higher (x + y) are closer to the screen foreground
    return (x + y) * 1000 + z * 50 + priority;
  }
}

window.Isometric = Isometric;
