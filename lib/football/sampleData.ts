import sampleDataJson from '../../public/data/football.sample.json';
import { parseFootballData } from './data';

/** A validated historical fixture for M4 development, never a live-roster feed. */
export const sampleFootballData = parseFootballData(sampleDataJson);
