'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Raycaster, Vector2, type Camera, type Mesh, type Vector3 } from 'three';
import { makeWorldTexture, type WorldData } from '@/lib/globe/texture';
import { createTapGuard, regionAtUv, type MapRegion, type RegionLookup } from '@/lib/globe/selection';
import { WORLD_TEXTURE_WIDTH, WORLD_TEXTURE_HEIGHT, lonLatToTexturePixel } from '@/lib/globe/geography';
import {
  tierForDistance,
  regionFileForTier,
  labelsForTier,
  continentForIso3,
  COUNTRY_TIER_DISTANCE,
  type CountryIndex,
  type LabelVisibility,
  type ZoomTier,
} from '@/lib/globe/zoomTiers';
import { projectLabel, GLOBE_RADIUS, type MapLabel } from '@/lib/globe/labels';
import { destinationsForMapRegion } from '@/lib/football/destinations';

export type Command = { kind: 'reset' | 'in' | 'out' | 'left' | 'right'; id: number } | null;
type Props = { selected: MapRegion | null; spin: boolean; reducedMotion: boolean; command: Command; onInteraction: () => void; onReady: () => void; onError: (message: string) => void; onHover: (region: MapRegion | null) => void; onSelect: (region: MapRegion | null) => void };

/** Region files carry a precomputed label anchor per feature (spec section 16). */
export interface RegionFeature {
  properties: { name: string; iso3: string; label?: [number, number] };
  geometry: WorldData['features'][number]['geometry'];
}
export interface RegionData { features: RegionFeature[]; }
interface CityRecord { name: string; iso3: string | null; lon: number; lat: number; capital: boolean; pop: number; }
interface CameraShot { camera: Camera; size: { width: number; height: number }; }

/** Reports camera-distance tier changes so detail loads as the user zooms. */
function TierTracker({ onTier }: { onTier: (tier: ZoomTier) => void }) {
  const camera = useThree(state => state.camera);
  const current = useRef<ZoomTier>('world');
  useFrame(() => {
    const next = tierForDistance(camera.position.length());
    if (next !== current.current) {
      current.current = next;
      onTier(next);
    }
  });
  return null;
}

/** Exposes the live camera and canvas size to the DOM label overlay. */
function CameraProbe({ probeRef }: { probeRef: RefObject<CameraShot | null> }) {
  const camera = useThree(state => state.camera);
  const size = useThree(state => state.size);
  useEffect(() => {
    probeRef.current = { camera, size };
  }, [camera, size, probeRef]);
  return null;
}

/**
 * Which continent's region file the globe shows below the world tier.
 * Adjusted during render (guarded by the previous inputs) so the value never
 * feeds back into its own computation. Prefers the selected map region, then
 * the continent under the camera, then a default so detail always loads.
 */
function useContinentId(
  tier: ZoomTier,
  countryIndex: CountryIndex,
  selected: MapRegion | null,
  facingContinent: () => string | null,
): string | null {
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const [continentId, setContinentId] = useState<string | null>(null);
  const key = `${tier}|${selected?.iso3 ?? ''}|${Object.keys(countryIndex).length}`;
  if (prevKey !== key) {
    setPrevKey(key);
    setContinentId(
      tier === 'world'
        ? null
        : (continentForIso3(countryIndex, selected?.iso3 ?? null) ?? facingContinent() ?? 'africa'),
    );
  }
  return continentId;
}

type EarthProps = Pick<Props, 'selected' | 'onReady' | 'onError' | 'onHover' | 'onSelect' | 'onInteraction' | 'reducedMotion'> & {
  tier: ZoomTier;
  countryIndex: CountryIndex;
  onGeoData: (data: RegionData, continentId: string | null) => void;
};

function Earth({ selected, tier, countryIndex, reducedMotion, onGeoData, onReady, onError, onHover, onSelect, onInteraction }: EarthProps) {
  const [world, setWorld] = useState<ReturnType<typeof makeWorldTexture> | null>(null);
  const mesh = useRef<Mesh>(null);
  const { camera, gl } = useThree();
  const cache = useRef(new Map<string, { data: RegionData; created: ReturnType<typeof makeWorldTexture> }>());
  const lookupRef = useRef<RegionLookup | null>(null);
  const readyRef = useRef(false);
  const zoomTarget = useRef<Vector3 | null>(null);
  const refreshHover = useRef<() => void>(() => {});

  // The continent under the camera, for when nothing is selected.
  const facingContinent = useCallback((): string | null => {
    const lookup = lookupRef.current;
    if (!lookup) return null;
    const point = camera.position.clone().normalize().multiplyScalar(GLOBE_RADIUS);
    const latitude = (Math.asin(Math.max(-1, Math.min(1, point.y / GLOBE_RADIUS))) * 180) / Math.PI;
    const longitude = (Math.atan2(-point.z, point.x) * 180) / Math.PI;
    const pixel = lonLatToTexturePixel(longitude, latitude);
    const region = regionAtUv(lookup, pixel.x / WORLD_TEXTURE_WIDTH, pixel.y / WORLD_TEXTURE_HEIGHT);
    return continentForIso3(countryIndex, region?.iso3 ?? null);
  }, [camera, countryIndex]);

  const continentId = useContinentId(tier, countryIndex, selected, facingContinent);

  const geoUrl = regionFileForTier(tier, continentId);

  // Tier-aware geography: the world file first, then region-scoped 50m files
  // as the user dives in. The previous texture stays up while the next loads.
  useEffect(() => {
    let cancelled = false;
    const apply = (data: RegionData, created: ReturnType<typeof makeWorldTexture>) => {
      lookupRef.current = created.lookup;
      setWorld(created);
      onGeoData(data, continentId);
      if (!readyRef.current) {
        readyRef.current = true;
        onReady();
      }
    };
    const cached = cache.current.get(geoUrl);
    if (cached) {
      apply(cached.data, cached.created);
      return;
    }
    fetch(geoUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RegionData>;
      })
      .then(data => {
        if (cancelled) return;
        const created = makeWorldTexture(data);
        cache.current.set(geoUrl, { data, created });
        apply(data, created);
      })
      .catch(() => {
        if (cancelled) return;
        // Region detail is progressive enhancement: fall back to the world view.
        const fallback = cache.current.get('/data/world.geojson');
        if (geoUrl !== '/data/world.geojson' && fallback) {
          apply(fallback.data, fallback.created);
        } else if (geoUrl === '/data/world.geojson') {
          onError('The map could not load. Please reload.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [geoUrl, continentId, onGeoData, onReady, onError]);
  useEffect(() => () => {
    cache.current.forEach(entry => entry.created.texture.dispose());
    cache.current.clear();
  }, []);

  // Hover follows the current camera; OrbitControls updates at priority -1.
  // The same frame also eases any in-flight double-click zoom.
  useFrame(() => {
    refreshHover.current();
    const target = zoomTarget.current;
    if (target) {
      camera.position.lerp(target, 0.14);
      if (camera.position.distanceTo(target) < 0.03) zoomTarget.current = null;
    }
  });

  useEffect(() => {
    if (!world) return;
    const canvas = gl.domElement;
    const guard = createTapGuard();
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let hoverPosition: { x: number; y: number } | null = null;
    let hoverId: string | null = null;
    const publishHover = (region: MapRegion | null) => {
      if (hoverId !== (region?.iso3 ?? null)) {
        hoverId = region?.iso3 ?? null;
        onHover(region);
      }
    };
    const pick = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      if (!mesh.current || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
      pointer.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
      camera.updateMatrixWorld();
      mesh.current.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const uv = raycaster.intersectObject(mesh.current, false)[0]?.uv;
      return uv ? { region: regionAtUv(world.lookup, uv.x, uv.y) } : null;
    };
    const updateHover = () => {
      publishHover(hoverPosition && !guard.active ? pick(hoverPosition.x, hoverPosition.y)?.region ?? null : null);
    };
    const down = (event: PointerEvent) => {
      guard.down(event.pointerId, event.clientX, event.clientY, event.button === 0);
      // Presses beginning outside the sphere must not become selections on release.
      if (!pick(event.clientX, event.clientY)) guard.reject();
      updateHover();
    };
    const move = (event: PointerEvent) => {
      guard.move(event.pointerId, event.clientX, event.clientY);
      hoverPosition = event.pointerType !== 'touch' && event.target === canvas
        ? { x: event.clientX, y: event.clientY } : null;
      updateHover();
    };
    const up = (event: PointerEvent) => {
      if (guard.up(event.pointerId, event.clientX, event.clientY)) {
        const hit = pick(event.clientX, event.clientY);
        if (hit) onSelect(hit.region);
      }
      updateHover();
    };
    const cancel = (event: PointerEvent) => { guard.cancel(event.pointerId); updateHover(); };
    const leave = () => { hoverPosition = null; publishHover(null); };
    const blur = () => { guard.clear(); leave(); };
    const wheel = () => guard.reject();
    // Double-click dives toward the tapped point, into the country tier.
    const dive = (event: MouseEvent) => {
      if (!mesh.current) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      camera.updateMatrixWorld();
      mesh.current.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(mesh.current, false)[0];
      if (!hit) return;
      const target = hit.point.clone().normalize().multiplyScalar(COUNTRY_TIER_DISTANCE - 0.25);
      if (reducedMotion) camera.position.copy(target);
      else zoomTarget.current = target;
      onInteraction();
    };
    refreshHover.current = updateHover;
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: true });
    canvas.addEventListener('dblclick', dive);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', blur);
    return () => {
      refreshHover.current = () => {};
      zoomTarget.current = null;
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', dive);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', blur);
      onHover(null);
    };
  }, [world, camera, gl, reducedMotion, onHover, onSelect, onInteraction]);
  useEffect(() => { world?.setSelection(selected?.iso3 ?? null); }, [world, selected]);
  const texture = world?.texture;
  return <mesh ref={mesh}>
    <sphereGeometry args={[GLOBE_RADIUS, 96, 64]} />
    {/* Recreate the material when the async map arrives so its shader includes the texture. */}
    <meshStandardMaterial key={texture?.uuid ?? 'loading'} map={texture} color={texture ? '#ffffff' : '#2794d8'} roughness={1} />
  </mesh>;
}

function Controls({ spin, reducedMotion, command, onInteraction }: Pick<Props, 'spin' | 'reducedMotion' | 'command' | 'onInteraction'>) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const orbit = controls.current;
    if (!command || !orbit) return;
    const camera = orbit.object;
    if (command.kind === 'reset') {
      // Consume pending movement before restoring the view, within the same frame.
      const damping = orbit.enableDamping;
      orbit.autoRotate = false;
      orbit.enableDamping = false;
      orbit.update();
      orbit.enableDamping = damping;
      camera.position.set(3.9, 1.5, -0.55); orbit.target.set(0,0,0);
    } else if (command.kind === 'in' || command.kind === 'out') {
      camera.position.multiplyScalar(command.kind === 'in' ? 0.88 : 1.12);
      camera.position.setLength(Math.max(2.5, Math.min(6.5, camera.position.length())));
    } else {
      const a = command.kind === 'left' ? 0.2 : -0.2, x = camera.position.x, z = camera.position.z;
      camera.position.x = x * Math.cos(a) - z * Math.sin(a);
      camera.position.z = x * Math.sin(a) + z * Math.cos(a);
    }
    orbit.update(); invalidate();
  }, [command, invalidate]);
  // Discard pending damping momentum when the preference changes, preserving the camera.
  return <OrbitControls key={reducedMotion ? 'reduced' : 'normal'} ref={controls} enablePan={false} enableDamping={!reducedMotion} dampingFactor={0.09} minDistance={2.5} maxDistance={6.5} autoRotate={spin && !reducedMotion} autoRotateSpeed={0.45} minPolarAngle={0.2} maxPolarAngle={Math.PI-0.2} onStart={onInteraction} />;
}

/**
 * HTML label overlay (spec section 16): crisp text the pixel texture could never
 * carry. Positions update on a throttled rAF loop with direct DOM writes, so the
 * overlay never triggers React re-renders. A greedy pass drops labels that would
 * collide, keeping tiny neighbours readable.
 */
const LABEL_MIN_GAP = 26;

function LabelLayer({ labels, visible, probeRef }: { labels: MapLabel[]; visible: LabelVisibility; probeRef: RefObject<CameraShot | null> }) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 90) return;
      last = now;
      const shot = probeRef.current;
      if (!shot) return;
      const { camera, size } = shot;
      const placed: { x: number; y: number }[] = [];
      for (const label of labels) {
        const node = nodes.current.get(label.id);
        if (!node) continue;
        const inLayer = label.kind === 'country' ? visible.countries : visible.cities;
        if (!inLayer) {
          node.style.display = 'none';
          continue;
        }
        const projected = projectLabel(label.latitude, label.longitude, camera, size.width, size.height);
        const collides = placed.some(done => Math.abs(done.x - projected.x) < LABEL_MIN_GAP && Math.abs(done.y - projected.y) < LABEL_MIN_GAP);
        if (!projected.visible || collides) {
          node.style.display = 'none';
          continue;
        }
        placed.push({ x: projected.x, y: projected.y });
        node.style.display = label.kind === 'city' ? 'flex' : 'block';
        node.style.transform = `translate(-50%,-135%) translate(${projected.x.toFixed(1)}px, ${projected.y.toFixed(1)}px)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [labels, visible, probeRef]);
  return <div className="globe-labels" aria-hidden="true">
    {labels.map(label => <div
      key={label.id}
      ref={node => {
        if (node) nodes.current.set(label.id, node);
        else nodes.current.delete(label.id);
      }}
      className={`globe-label globe-label--${label.kind}${label.destination ? ' is-destination' : ''}`}
    >
      {label.kind === 'city' ? <span className="globe-label-dot" aria-hidden="true" /> : null}
      <span>{label.text}</span>
    </div>)}
  </div>;
}

const MAX_CITY_LABELS = 40;

export default function GlobeScene(props: Props) {
  const [tier, setTier] = useState<ZoomTier>('world');
  const [geo, setGeo] = useState<{ data: RegionData; continentId: string | null } | null>(null);
  const [cities, setCities] = useState<CityRecord[]>([]);
  const [countryIndex, setCountryIndex] = useState<CountryIndex>({});
  const probe = useRef<CameraShot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = <T,>(url: string, apply: (data: T) => void) => {
      fetch(url, { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<T>;
        })
        .then(data => { if (!controller.signal.aborted) apply(data); })
        .catch(() => {});
    };
    load('/data/cities.json', setCities);
    load('/data/country-index.json', setCountryIndex);
    return () => controller.abort();
  }, []);

  const onTier = useCallback((next: ZoomTier) => setTier(next), []);
  const onGeoData = useCallback((data: RegionData, continentId: string | null) => setGeo({ data, continentId }), []);

  const labels = useMemo<MapLabel[]>(() => {
    if (!geo) return [];
    const visibility = labelsForTier(tier);
    const out: MapLabel[] = [];
    if (visibility.countries) {
      const countries = geo.data.features
        .filter(feature => feature.properties.label)
        .map(feature => ({
          id: `country:${feature.properties.iso3}`,
          text: feature.properties.name,
          latitude: feature.properties.label![1],
          longitude: feature.properties.label![0],
          kind: 'country' as const,
          destination: destinationsForMapRegion(feature.properties.iso3).length > 0,
        }));
      // Tracked destinations win label collisions against their neighbours.
      countries.sort((a, b) => Number(b.destination) - Number(a.destination) || a.id.localeCompare(b.id));
      out.push(...countries);
    }
    if (visibility.cities && geo.continentId) {
      const inRegion = cities.filter(city => city.iso3 && countryIndex[city.iso3] === geo.continentId);
      inRegion.sort((a, b) => Number(b.capital) - Number(a.capital) || b.pop - a.pop);
      for (const city of inRegion.slice(0, MAX_CITY_LABELS)) {
        out.push({
          id: `city:${city.name}:${city.lon.toFixed(2)}`,
          text: city.name,
          latitude: city.lat,
          longitude: city.lon,
          kind: 'city',
          destination: false,
        });
      }
    }
    return out;
  }, [geo, tier, cities, countryIndex]);

  const visibility = labelsForTier(tier);

  return <div className="globe-stage">
    <Canvas camera={{ position: [3.9,1.5,-0.55], fov: 45 }} dpr={[1,1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<p className="globe-message">Your browser does not support the interactive globe.</p>}>
      <ambientLight intensity={1.7} /><directionalLight position={[5,5,3]} intensity={1.8} />
      <Earth selected={props.selected} tier={tier} countryIndex={countryIndex} reducedMotion={props.reducedMotion} onGeoData={onGeoData} onReady={props.onReady} onError={props.onError} onHover={props.onHover} onSelect={props.onSelect} onInteraction={props.onInteraction} />
      <TierTracker onTier={onTier} />
      <CameraProbe probeRef={probe} />
      <Controls spin={props.spin} reducedMotion={props.reducedMotion} command={props.command} onInteraction={props.onInteraction} />
    </Canvas>
    <LabelLayer labels={labels} visible={visibility} probeRef={probe} />
  </div>;
}
