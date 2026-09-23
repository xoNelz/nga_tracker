'use client';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Raycaster, Vector2, type Mesh } from 'three';
import { makeWorldTexture, type WorldData } from '@/lib/globe/texture';
import { createTapGuard, regionAtUv, type MapRegion } from '@/lib/globe/selection';

export type Command = { kind: 'reset' | 'in' | 'out' | 'left' | 'right'; id: number } | null;
type Props = { selected: MapRegion | null; spin: boolean; reducedMotion: boolean; command: Command; onInteraction: () => void; onReady: () => void; onError: (message: string) => void; onHover: (region: MapRegion | null) => void; onSelect: (region: MapRegion | null) => void };

function Earth({ selected, onReady, onError, onHover, onSelect }: Pick<Props, 'selected' | 'onReady' | 'onError' | 'onHover' | 'onSelect'>) {
  const [world, setWorld] = useState<ReturnType<typeof makeWorldTexture> | null>(null);
  const mesh = useRef<Mesh>(null);
  const { camera, gl } = useThree();
  const refreshHover = useRef<() => void>(() => {});
  // OrbitControls updates at priority -1; hit detection follows the current camera.
  useFrame(() => refreshHover.current());
  useEffect(() => {
    const controller = new AbortController();
    let created: ReturnType<typeof makeWorldTexture> | undefined;
    fetch('/data/world.geojson', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('The map could not load. Please reload.'); return r.json() as Promise<WorldData>; })
      .then(data => { if (controller.signal.aborted) return; created = makeWorldTexture(data); setWorld(created); onReady(); })
      .catch(error => { if (!controller.signal.aborted) onError(error instanceof Error ? error.message : 'The globe could not load.'); });
    return () => { controller.abort(); created?.texture.dispose(); };
  }, [onReady, onError]);
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
    refreshHover.current = updateHover;
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', blur);
    return () => {
      refreshHover.current = () => {};
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', blur);
      onHover(null);
    };
  }, [world, camera, gl, onHover, onSelect]);
  useEffect(() => { world?.setSelection(selected?.iso3 ?? null); }, [world, selected]);
  const texture = world?.texture;
  return <mesh ref={mesh}>
    <sphereGeometry args={[1.45, 96, 64]} />
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

export default function GlobeScene(props: Props) {
  return <Canvas camera={{ position: [3.9,1.5,-0.55], fov: 45 }} dpr={[1,1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<p className="globe-message">Your browser does not support the interactive globe.</p>}>
    <ambientLight intensity={1.7} /><directionalLight position={[5,5,3]} intensity={1.8} />
    <Earth selected={props.selected} onReady={props.onReady} onError={props.onError} onHover={props.onHover} onSelect={props.onSelect} />
    <Controls spin={props.spin} reducedMotion={props.reducedMotion} command={props.command} onInteraction={props.onInteraction} />
  </Canvas>;
}
