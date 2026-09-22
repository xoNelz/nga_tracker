import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { WORLD_TEXTURE_WIDTH, WORLD_TEXTURE_HEIGHT, lonLatToTexturePixel, unwrapRing, type Ring } from './geography';
import { assignRegionCoverage, type RegionLookup } from './selection';
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
export type WorldData = { features: { properties: { name: string; iso3: string }; geometry: Geometry }[] };

export function makeWorldTexture(data: WorldData) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_TEXTURE_WIDTH; canvas.height = WORLD_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the world texture.');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2794d8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mask = document.createElement('canvas');
  mask.width = canvas.width; mask.height = canvas.height;
  const maskContext = mask.getContext('2d', { willReadFrequently: true });
  if (!maskContext) throw new Error('Could not create the region lookup.');
  const lookup: RegionLookup = {
    width: canvas.width, height: canvas.height,
    ids: new Uint16Array(canvas.width * canvas.height),
    regions: data.features.map(feature => feature.properties),
  };
  const coverage = new Uint8Array(lookup.ids.length);
  for (const [featureIndex, feature] of data.features.entries()) {
    maskContext.clearRect(0, 0, mask.width, mask.height);
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      const rings = polygon.map(unwrapRing);
      const anchor = rings[0][0][0];
      for (const ring of rings.slice(1)) {
        const shift = Math.round((anchor - ring[0][0]) / 360) * 360;
        for (const point of ring) point[0] += shift;
      }
      for (const shift of [-360, 0, 360]) {
        const path = new Path2D();
        for (const ring of rings) {
          ring.forEach(([lon, lat], index) => {
            const { x, y } = lonLatToTexturePixel(lon + shift, lat);
            if (index === 0) path.moveTo(x, y); else path.lineTo(x, y);
          });
          path.closePath();
        }
        const name = feature.properties.name;
        ctx.fillStyle = name === 'Nigeria' ? '#008751' : ['Antarctica', 'Greenland'].includes(name) ? '#d7e8dc' :
          ['Algeria', 'Libya', 'Egypt', 'Saudi Arabia', 'Sudan', 'Mali', 'Niger', 'Chad', 'Mauritania'].includes(name) ? '#d2b36f' : '#87c65c';
        ctx.fill(path, 'evenodd');
        maskContext.fill(path, 'evenodd');
      }
    }
    assignRegionCoverage(lookup.ids, coverage, maskContext.getImageData(0, 0, mask.width, mask.height).data, featureIndex + 1);
  }
  // Remove canvas edge antialiasing so every texel uses a crisp palette entry.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const palette = [[39,148,216],[0,135,81],[215,232,220],[210,179,111],[135,198,92]];
  for (let i = 0; i < pixels.data.length; i += 4) {
    let best = palette[0], distance = Infinity;
    for (const color of palette) {
      const d = color.reduce((sum, value, channel) => sum + (value - pixels.data[i + channel]) ** 2, 0);
      if (d < distance) { distance = d; best = color; }
    }
    pixels.data[i] = best[0]; pixels.data[i+1] = best[1]; pixels.data[i+2] = best[2]; pixels.data[i+3] = 255;
    // Never select a texel that the actual visible palette classified as ocean.
    if (best === palette[0]) lookup.ids[i / 4] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = NearestFilter; texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  return { texture, lookup };
}
