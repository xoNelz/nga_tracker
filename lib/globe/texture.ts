import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
type Ring = number[][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
export type WorldData = { features: { properties: { name: string; iso3: string }; geometry: Geometry }[] };

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

export function makeWorldTexture(data: WorldData) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the world texture.');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2794d8'; ctx.fillRect(0, 0, 512, 256);
  for (const feature of data.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      const rings = polygon.map(unwrapRing);
      const anchor = rings[0][0][0];
      for (const ring of rings.slice(1)) {
        const shift = Math.round((anchor - ring[0][0]) / 360) * 360;
        for (const point of ring) point[0] += shift;
      }
      for (const shift of [-360, 0, 360]) {
        ctx.beginPath();
        for (const ring of rings) {
          ring.forEach(([lon, lat], index) => {
            const x = Math.round((lon + shift + 180) / 360 * 512);
            const y = Math.round((90 - lat) / 180 * 256);
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        const name = feature.properties.name;
        ctx.fillStyle = name === 'Nigeria' ? '#008751' : ['Antarctica', 'Greenland'].includes(name) ? '#d7e8dc' :
          ['Algeria', 'Libya', 'Egypt', 'Saudi Arabia', 'Sudan', 'Mali', 'Niger', 'Chad', 'Mauritania'].includes(name) ? '#d2b36f' : '#87c65c';
        ctx.fill('evenodd');
      }
    }
  }
  // Remove canvas edge antialiasing so every texel uses a crisp palette entry.
  const pixels = ctx.getImageData(0, 0, 512, 256);
  const palette = [[39,148,216],[0,135,81],[215,232,220],[210,179,111],[135,198,92]];
  for (let i = 0; i < pixels.data.length; i += 4) {
    let best = palette[0], distance = Infinity;
    for (const color of palette) {
      const d = color.reduce((sum, value, channel) => sum + (value - pixels.data[i + channel]) ** 2, 0);
      if (d < distance) { distance = d; best = color; }
    }
    pixels.data[i] = best[0]; pixels.data[i+1] = best[1]; pixels.data[i+2] = best[2]; pixels.data[i+3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = NearestFilter; texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}
