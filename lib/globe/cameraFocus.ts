import { CONTINENT_TIER_DISTANCE, COUNTRY_TIER_DISTANCE } from './zoomTiers';

export type CameraFocus = {
  latitude: number;
  longitude: number;
  distance: number;
};

export const CONTINENT_FOCUS_DISTANCE = (CONTINENT_TIER_DISTANCE + COUNTRY_TIER_DISTANCE) / 2;
export const COUNTRY_FOCUS_DISTANCE = 2.75;

const destinationCenters: Readonly<Record<string, readonly [longitude: number, latitude: number]>> = {
  england: [-1.17, 52.36],
  scotland: [-4.2, 56.49],
  wales: [-3.78, 52.13],
  'northern-ireland': [-6.49, 54.79],
  ireland: [-7.69, 53.14],
  nigeria: [8.68, 9.08],
};

export function continentCameraFocus(center: readonly [longitude: number, latitude: number]): CameraFocus {
  return { longitude: center[0], latitude: center[1], distance: CONTINENT_FOCUS_DISTANCE };
}

export function destinationCameraFocus(destinationId: string): CameraFocus | null {
  const center = destinationCenters[destinationId];
  return center ? { longitude: center[0], latitude: center[1], distance: COUNTRY_FOCUS_DISTANCE } : null;
}

/** Camera position looking from a geographic point toward the globe origin. */
export function cameraPositionForFocus({ latitude, longitude, distance }: CameraFocus): [number, number, number] {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return [
    distance * Math.cos(lat) * Math.cos(lon),
    distance * Math.sin(lat),
    -distance * Math.cos(lat) * Math.sin(lon),
  ];
}
