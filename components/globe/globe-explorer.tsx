'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Command } from './globe-scene';
import { destinationsForMapRegion, type Destination } from '@/lib/football/destinations';
import { hierarchyCrumbs, type HierarchyLevel } from '@/lib/football/hierarchy';
import { hierarchyNavigationItems, mapRegionForDestination, type ContinentOption, type HierarchyNavigationItem } from '@/lib/football/navigation';
import type { MapRegion } from '@/lib/globe/selection';
const Scene = dynamic(() => import('./globe-scene'), { ssr: false, loading: () => <p className="globe-message">Loading the world…</p> });
type CountryIndex = Record<string, string>;

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
  const [activeContinentId, setActiveContinentId] = useState<string | null>(null);
  const [countryIndex, setCountryIndex] = useState<CountryIndex>({});
  const [continents, setContinents] = useState<ContinentOption[]>([]);
  const [continentNames, setContinentNames] = useState<Record<string, string>>({});
  const [navigationLoaded, setNavigationLoaded] = useState(false);
  const selectMapRegion = useCallback((region: MapRegion | null) => {
    setSelected(region);
    if (region) setActiveContinentId(countryIndex[region.iso3] ?? null);
    const choices = destinationsForMapRegion(region?.iso3 ?? null);
    setDestination(choices.length === 1 ? choices[0] : null);
  }, [countryIndex]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/data/country-index.json').then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CountryIndex>;
      }),
      fetch('/data/continents.json').then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ContinentOption[]>;
      }),
    ]).then(([index, continents]) => {
      if (cancelled) return;
      setCountryIndex(index);
      setContinents(continents);
      setContinentNames(Object.fromEntries(continents.map(item => [item.continent_id, item.continent_name])));
    }).catch(() => {
      // The globe remains usable; hierarchy context stays at World until data is available.
    }).finally(() => {
      if (!cancelled) setNavigationLoaded(true);
    });
    return () => { cancelled = true; };
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
    if (kind === 'reset') { setHovered(null); setSelected(null); setDestination(null); setActiveContinentId(null); }
    setCommand(previous => ({kind, id:(previous?.id??0)+1}));
  };
  const available = ready && !error;
  const resolvedContinentId = selected ? countryIndex[selected.iso3] ?? activeContinentId : activeContinentId;
  const crumbs = hierarchyCrumbs({ activeContinentId: resolvedContinentId, continentNames, destination, selected });
  const currentContext = crumbs[crumbs.length - 1];
  const navigationItems = hierarchyNavigationItems(resolvedContinentId, continents);
  const returnTo = (level: HierarchyLevel) => {
    setSpin(false);
    if (level === 'world') {
      issue('reset');
      return;
    }
    setActiveContinentId(resolvedContinentId);
    setSelected(null);
    setDestination(null);
  };
  const navigateTo = (item: HierarchyNavigationItem) => {
    setSpin(false);
    setHovered(null);
    if (item.kind === 'continent') {
      setActiveContinentId(item.id);
      setSelected(null);
      setDestination(null);
      return;
    }
    if (item.kind === 'home') {
      setActiveContinentId('africa');
      setSelected({ iso3: 'NGA', name: 'Nigeria' });
      setDestination(null);
      return;
    }
    setActiveContinentId(item.destination.continent_id);
    setSelected(mapRegionForDestination(item.destination));
    setDestination(item.destination);
  };
  return <main className="explorer">
    <header className="app-header"><Link className="brand" href="/" aria-label="Naija Player Tracker home"><span className="flag" aria-hidden="true" /><span>NAIJA<span className="brand-secondary">PLAYER TRACKER</span></span></Link><span className="edition">GLOBE PROTOTYPE / 01</span></header>
    <section className="world-stage" aria-label="Interactive world globe">
      <nav className="hierarchy-breadcrumb" aria-label="Current exploration level">
        <ol>{crumbs.map((crumb, index) => <li key={crumb.level}>
          {index < crumbs.length - 1
            ? <button type="button" onClick={() => returnTo(crumb.level)}>{crumb.label}</button>
            : <span aria-current="page">{crumb.label}</span>}
        </li>)}</ol>
      </nav>
      <div className="world-context"><span className="context-index">{String(crumbs.length).padStart(2, '0')} /</span><h1>{currentContext.label}</h1></div>
      <div className="globe-viewport" aria-label="Drag to rotate. Scroll or pinch to zoom. Click or tap land to select a map region."><Boundary><Scene selected={selected} reducedMotion={reduced} spin={spin && !reduced && !error} command={command} onReady={onReady} onError={onError} onInteraction={pause} onHover={setHovered} onSelect={selectMapRegion} /></Boundary>{error && <p className="globe-message" role="alert">{error}</p>}</div>
      <div className="region-readout" aria-label="Map region selection">
        <p>Hovering: <span>{hovered?.name ?? '—'}</span></p>
        <p role="status" aria-live="polite" aria-atomic="true">Selected: <span>{selected?.name ?? 'None'}</span></p>
      </div>
      <nav className="hierarchy-navigator" aria-label="Explore by hierarchy">
        <p className="hierarchy-navigator__label">{resolvedContinentId ? 'CHOOSE A FOOTBALL DESTINATION' : 'CHOOSE A CONTINENT'}</p>
        {navigationItems.length > 0 ? <ul>{navigationItems.map(item => {
          const current = item.kind === 'destination'
            ? destination?.country_id === item.id
            : item.kind === 'home' && selected?.iso3 === 'NGA';
          return <li key={`${item.kind}-${item.id}`}><button type="button" aria-current={current ? 'page' : undefined} onClick={() => navigateTo(item)}>{item.label}</button></li>;
        })}</ul> : <p className="hierarchy-navigator__empty">{navigationLoaded ? 'No sample football destinations are available here yet.' : 'Loading navigation…'}</p>}
        <p className="hierarchy-navigator__status" role="status" aria-live="polite" aria-atomic="true">Current destination: <strong>{selected?.iso3 === 'NGA' ? 'Nigeria · Home' : destination?.country_name ?? 'None'}</strong></p>
      </nav>
      <div className="stage-note"><span className="note-rule" />NIGERIAN FOOTBALLERS ABROAD</div>
      <div className="world-controls" aria-label="Globe controls">
        <div className="control-group"><Button variant="outline" className="pixel-button" disabled={!available||reduced} aria-pressed={spin&&!reduced} onClick={()=>setSpin(value=>!value)}>{spin&&!reduced?'Ⅱ PAUSE SPIN':'▷ RESUME SPIN'}</Button><Button variant="outline" className="pixel-button" disabled={!available} onClick={()=>issue('reset')}>RESET VIEW</Button></div>
        <div className="control-group">{([{kind:'left',label:'Rotate left',symbol:'←'},{kind:'right',label:'Rotate right',symbol:'→'},{kind:'out',label:'Zoom out',symbol:'−'},{kind:'in',label:'Zoom in',symbol:'+'}] as const).map(c=><Button key={c.kind} variant="outline" className="pixel-button square-button" disabled={!available} aria-label={c.label} onClick={()=>issue(c.kind)}>{c.symbol}</Button>)}</div>
      </div>
      <p className="interaction-hint">DRAG TO ROTATE <span aria-hidden="true">/</span> SCROLL OR PINCH TO ZOOM <span aria-hidden="true">/</span> DOUBLE-CLICK TO DIVE IN</p>
      <p className="selection-hint">CLICK OR TAP LAND TO SELECT A MAP REGION</p>
      <p className="sr-only" role="status">{error??(!ready?'Loading globe.':reduced?'Automatic spin disabled for reduced motion.':spin?'Globe loaded. Automatic spin running.':'Automatic spin paused.')}</p>
    </section>
    <footer className="app-footer"><span>WORLD → CONTINENT → COUNTRY → CLUB → PLAYER</span><span>PLAYER DISCOVERY COMING NEXT</span></footer>
  </main>;
}
