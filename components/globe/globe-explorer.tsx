'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Command } from './globe-scene';
import { destinations, destinationsForMapRegion, type Destination } from '@/lib/football/destinations';
import type { MapRegion } from '@/lib/globe/selection';
const Scene = dynamic(() => import('./globe-scene'), { ssr: false, loading: () => <p className="globe-message">Loading the world…</p> });

class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p role="alert" className="globe-message">The globe could not start. Please reload in a browser with WebGL support.</p> : this.props.children; }
}

export default function GlobeExplorer() {
  const [spin, setSpin] = useState(false), [reduced, setReduced] = useState(true);
  const [ready, setReady] = useState(false), [error, setError] = useState<string|null>(null);
  const [command, setCommand] = useState<Command>(null);
  const [hovered, setHovered] = useState<MapRegion | null>(null);
  const [selected, setSelected] = useState<MapRegion | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const selectMapRegion = useCallback((region: MapRegion | null) => {
    setSelected(region);
    const choices = destinationsForMapRegion(region?.iso3 ?? null);
    setDestination(choices.length === 1 ? choices[0] : null);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let firstRead = true;
    const apply = () => {
      setReduced(media.matches);
      // Only the initial preference read may start spin; later changes leave it paused.
      setSpin(firstRead && !media.matches);
      firstRead = false;
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback((message:string) => { setError(message); setSpin(false); }, []);
  const pause = useCallback(() => setSpin(false), []);
  const issue = (kind: NonNullable<Command>['kind']) => {
    setSpin(false);
    if (kind === 'reset') { setHovered(null); setSelected(null); setDestination(null); }
    setCommand(previous => ({kind, id:(previous?.id??0)+1}));
  };
  const available = ready && !error;
  return <main className="explorer">
    <header className="app-header"><Link className="brand" href="/" aria-label="Naija Player Tracker home"><span className="flag" aria-hidden="true" /><span>NAIJA<span className="brand-secondary">PLAYER TRACKER</span></span></Link><span className="edition">GLOBE PROTOTYPE / 01</span></header>
    <section className="world-stage" aria-label="Interactive world globe">
      <div className="world-context"><span className="context-index">01 /</span><h1>WORLD</h1></div>
      <div className="globe-viewport" aria-label="Drag to rotate. Scroll or pinch to zoom. Click or tap land to select a map region."><Boundary><Scene selected={selected} reducedMotion={reduced} spin={spin && !reduced && !error} command={command} onReady={onReady} onError={onError} onInteraction={pause} onHover={setHovered} onSelect={selectMapRegion} /></Boundary>{error && <p className="globe-message" role="alert">{error}</p>}</div>
      <div className="region-readout" aria-label="Map region selection">
        <p>Hovering: <span>{hovered?.name ?? '—'}</span></p>
        <p role="status" aria-live="polite" aria-atomic="true">Selected: <span>{selected?.name ?? 'None'}</span></p>
      </div>
      <div className="destination-chooser">
        <label htmlFor="football-destination">Football destination · Europe</label>
        <select id="football-destination" value={destination?.country_id ?? ''}
          aria-describedby="destination-help" onChange={event => {
            setDestination(destinations.find(item => item.country_id === event.target.value) ?? null);
            setSpin(false);
          }}>
          <option value="">Choose a destination</option>
          {destinations.map(item => <option key={item.country_id} value={item.country_id}>{item.country_name}</option>)}
        </select>
        <p id="destination-help">{selected?.iso3 === 'GBR'
          ? 'UK map selected: choose England, Scotland, Wales or Northern Ireland. Ireland is separate.'
          : 'Choose a football destination independently of the map region.'}</p>
        <p role="status" aria-live="polite" aria-atomic="true">Football destination: <strong>{destination?.country_name ?? 'None'}</strong></p>
        <p>The globe outline shows the selected map region, not the football destination.</p>
      </div>
      <div className="stage-note"><span className="note-rule" />NIGERIAN FOOTBALLERS ABROAD</div>
      <div className="world-controls" aria-label="Globe controls">
        <div className="control-group"><Button variant="outline" className="pixel-button" disabled={!available||reduced} aria-pressed={spin&&!reduced} onClick={()=>setSpin(value=>!value)}>{spin&&!reduced?'Ⅱ PAUSE SPIN':'▷ RESUME SPIN'}</Button><Button variant="outline" className="pixel-button" disabled={!available} onClick={()=>issue('reset')}>RESET VIEW</Button></div>
        <div className="control-group">{([{kind:'left',label:'Rotate left',symbol:'←'},{kind:'right',label:'Rotate right',symbol:'→'},{kind:'out',label:'Zoom out',symbol:'−'},{kind:'in',label:'Zoom in',symbol:'+'}] as const).map(c=><Button key={c.kind} variant="outline" className="pixel-button square-button" disabled={!available} aria-label={c.label} onClick={()=>issue(c.kind)}>{c.symbol}</Button>)}</div>
      </div>
      <p className="interaction-hint">DRAG TO ROTATE <span aria-hidden="true">/</span> SCROLL OR PINCH TO ZOOM</p>
      <p className="selection-hint">CLICK OR TAP LAND TO SELECT A MAP REGION</p>
      <p className="sr-only" role="status">{error??(!ready?'Loading globe.':reduced?'Automatic spin disabled for reduced motion.':spin?'Globe loaded. Automatic spin running.':'Automatic spin paused.')}</p>
    </section>
    <footer className="app-footer"><span>WORLD → CONTINENT → COUNTRY → CLUB → PLAYER</span><span>PLAYER DISCOVERY COMING NEXT</span></footer>
  </main>;
}
