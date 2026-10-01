import { Camera, Vector3 } from 'three';

// Matches the sphere radius in globe-scene.tsx.
export const GLOBE_RADIUS = 1.45;

export interface MapLabel {
  id: string;
  text: string;
  latitude: number;
  longitude: number;
  kind: 'country' | 'city';
  /** Tracked football destination; emphasized over the orientation layer. */
  destination: boolean;
}

/**
 * lon/lat to a point on the sphere surface, using the same convention as the
 * texture mapping (lon 0 at +x, lat 0 on the equator). Matches SphereGeometry
 * UVs: u = (lon + 180) / 360, v = (90 - lat) / 180.
 */
export function latLonToGlobePoint(latitude: number, longitude: number, radius = GLOBE_RADIUS): Vector3 {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

export interface ProjectedLabel {
  x: number;
  y: number;
  visible: boolean;
}

// Keep labels slightly inside the geometric horizon to avoid edge flicker.
const HORIZON_INSET = 0.04;

/**
 * Project a label anchor to screen pixels. The globe mesh sits at the origin
 * and never rotates (OrbitControls moves the camera), so camera.position is
 * the view vector. Pure and unit-testable; the overlay calls it per frame.
 */
export function projectLabel(
  latitude: number,
  longitude: number,
  camera: Camera,
  width: number,
  height: number,
  radius = GLOBE_RADIUS,
): ProjectedLabel {
  const point = latLonToGlobePoint(latitude, longitude, radius);
  // Measure from the surface point to the real camera. Using only the
  // camera's direction from the globe centre treats the camera as infinitely
  // distant and can expose labels that are actually hidden by the globe.
  const facing = point
    .clone()
    .normalize()
    .dot(camera.position.clone().sub(point).normalize());
  const ndc = point.project(camera);
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
    visible: facing > HORIZON_INSET && ndc.z < 1,
  };
}
