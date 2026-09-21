'use client';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { CanvasTexture } from 'three';
import { makeWorldTexture, type WorldData } from '@/lib/globe/texture';

export type Command = { kind: 'reset' | 'in' | 'out' | 'left' | 'right'; id: number } | null;
type Props = { spin: boolean; command: Command; onInteraction: () => void; onReady: () => void; onError: (message: string) => void };

function Earth({ onReady, onError }: Pick<Props, 'onReady' | 'onError'>) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let created: CanvasTexture | undefined;
    fetch('/data/world.geojson', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('The map could not load. Please reload.'); return r.json() as Promise<WorldData>; })
      .then(data => { if (controller.signal.aborted) return; created = makeWorldTexture(data); setTexture(created); onReady(); })
      .catch(error => { if (!controller.signal.aborted) onError(error instanceof Error ? error.message : 'The globe could not load.'); });
    return () => { controller.abort(); created?.dispose(); };
  }, [onReady, onError]);
  return <mesh><sphereGeometry args={[1.45, 96, 64]} /><meshStandardMaterial map={texture} color={texture ? '#ffffff' : '#2794d8'} roughness={1} /></mesh>;
}

function Controls({ spin, command, onInteraction }: Pick<Props, 'spin' | 'command' | 'onInteraction'>) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (!command) return;
    if (command.kind === 'reset') {
      camera.position.set(3.9, 1.5, -0.55); controls.current?.target.set(0,0,0);
    } else if (command.kind === 'in' || command.kind === 'out') {
      camera.position.multiplyScalar(command.kind === 'in' ? 0.88 : 1.12);
      camera.position.setLength(Math.max(2.5, Math.min(6.5, camera.position.length())));
    } else {
      const a = command.kind === 'left' ? 0.2 : -0.2, x = camera.position.x, z = camera.position.z;
      camera.position.x = x * Math.cos(a) - z * Math.sin(a);
      camera.position.z = x * Math.sin(a) + z * Math.cos(a);
    }
    controls.current?.update(); invalidate();
  }, [command, camera, invalidate]);
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.09} minDistance={2.5} maxDistance={6.5} autoRotate={spin} autoRotateSpeed={0.45} minPolarAngle={0.2} maxPolarAngle={Math.PI-0.2} onStart={onInteraction} />;
}

export default function GlobeScene(props: Props) {
  return <Canvas camera={{ position: [3.9,1.5,-0.55], fov: 45 }} dpr={[1,1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<p className="globe-message">Your browser does not support the interactive globe.</p>}>
    <ambientLight intensity={1.7} /><directionalLight position={[5,5,3]} intensity={1.8} />
    <Earth onReady={props.onReady} onError={props.onError} />
    <Controls spin={props.spin} command={props.command} onInteraction={props.onInteraction} />
  </Canvas>;
}
