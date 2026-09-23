export type MapRegion = { name: string; iso3: string };
export type RegionLookup = {
  width: number;
  height: number;
  ids: Uint16Array;
  regions: MapRegion[];
};

/** Match nearest-filtered, clamp-to-edge CanvasTexture sampling (including v flip). */
export function regionAtUv(lookup: RegionLookup, u: number, v: number): MapRegion | null {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const x = Math.max(0, Math.min(lookup.width - 1, Math.floor(u * lookup.width)));
  const y = Math.max(0, Math.min(lookup.height - 1, Math.floor((1 - v) * lookup.height)));
  const id = lookup.ids[y * lookup.width + x];
  return id ? lookup.regions[id - 1] ?? null : null;
}

/** Resolve antialiased border coverage without interpreting blended RGB values as IDs. */
export function assignRegionCoverage(ids: Uint16Array, coverage: Uint8Array, rgba: Uint8ClampedArray, id: number) {
  for (let pixel = 0; pixel < ids.length; pixel++) {
    const alpha = rgba[pixel * 4 + 3];
    // Greatest coverage wins; ties follow the visible map's drawing order.
    if (alpha > 0 && alpha >= coverage[pixel]) {
      ids[pixel] = id;
      coverage[pixel] = alpha;
    }
  }
}

/** Track maximum excursion, not just the final displacement, and reject multi-touch. */
export function createTapGuard(tolerance = 6) {
  const pointers = new Map<number, { x: number; y: number }>();
  let rejected = false;
  const move = (id: number, x: number, y: number) => {
    const start = pointers.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > tolerance) rejected = true;
  };
  return {
    get active() { return pointers.size > 0; },
    down(id: number, x: number, y: number, primary = true) {
      if (!pointers.size) rejected = !primary;
      pointers.set(id, { x, y });
      if (pointers.size > 1) rejected = true;
    },
    move,
    up(id: number, x: number, y: number) {
      const known = pointers.has(id);
      move(id, x, y);
      pointers.delete(id);
      return known && !rejected && pointers.size === 0;
    },
    reject() { rejected = true; },
    cancel(id: number) { rejected = true; pointers.delete(id); },
    clear() { rejected = true; pointers.clear(); },
  };
}

/** Inner pixel boundary, wrapping longitude so the map seam is not an outline. */
export function regionOutlinePixels(lookup: RegionLookup, iso3: string | null): number[] {
  const id = iso3 ? lookup.regions.findIndex(region => region.iso3 === iso3) + 1 : 0;
  if (!id) return [];
  const { width, height, ids } = lookup;
  const outline: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (ids[index] !== id) continue;
    if (ids[y * width + (x + width - 1) % width] !== id ||
        ids[y * width + (x + 1) % width] !== id ||
        (y > 0 && ids[index - width] !== id) ||
        (y < height - 1 && ids[index + width] !== id)) outline.push(index);
  }
  return outline;
}
