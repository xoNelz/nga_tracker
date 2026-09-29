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

// Labels near or behind the limb stay hidden so they never flicker at the edge.
const FACING_CUTOFF = 0.12;

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
  const facing = point
    .clone()
    .normalize()
    .dot(camera.position.clone().normalize());
  const ndc = point.project(camera);
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
    visible: facing > FACING_CUTOFF && ndc.z < 1,
  };
}
