export const WORLD_TEXTURE_WIDTH = 512;
export const WORLD_TEXTURE_HEIGHT = 256;

export type Ring = number[][];

/** Canonical longitude in [-180, 180); both seam edges refer to -180. */
export function wrapLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

/**
 * Equirectangular canvas coordinates: north is at the top, east is to the right.
 * Keep unwrapped longitudes outside the image for drawing seam-crossing copies.
 * These are rounded path coordinates, not clamped pixel-array indices.
 */
export function lonLatToTexturePixel(
  longitude: number,
  latitude: number,
  width = WORLD_TEXTURE_WIDTH,
  height = WORLD_TEXTURE_HEIGHT,
): { x: number; y: number } {
  return {
    x: Math.round((longitude + 180) / 360 * width),
    y: Math.round((90 - latitude) / 180 * height),
  };
}

/** SphereGeometry UVs run south-to-north in v, unlike canvas y coordinates. */
export function globeUvToLonLat(u: number, v: number): { longitude: number; latitude: number } {
  return { longitude: wrapLongitude(u * 360 - 180), latitude: v * 180 - 90 };
}

/** Preserve each ring's short edges across the antimeridian without mutating its source. */
export function unwrapRing(ring: Ring): Ring {
  const result: Ring = [];
  for (const [longitude, latitude] of ring) {
    let lon = longitude;
    const previous = result.at(-1)?.[0];
    if (previous !== undefined) {
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
    }
    result.push([lon, latitude]);
  }
  return result;
}
