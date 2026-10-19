import type { Cylinder } from '../data/cylinders';
import { DEFAULT_CONFIG, type RunConfig } from './calc';

const K_CURRENT = 'cip-perf-current-v1';
const K_RUNS = 'cip-perf-runs-v1';
const K_CYLS = 'cip-perf-cylinders-v1';

export interface SavedRun {
  id: string;
  name: string;
  savedAt: string;
  config: RunConfig;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full / private mode */
  }
}

export const loadCurrent = (): RunConfig => ({ ...DEFAULT_CONFIG, ...read<Partial<RunConfig>>(K_CURRENT, {}) });
export const saveCurrent = (c: RunConfig) => write(K_CURRENT, c);
export const loadRuns = () => read<SavedRun[]>(K_RUNS, []);
export const saveRuns = (r: SavedRun[]) => write(K_RUNS, r);
export const loadCustomCylinders = () => read<Cylinder[]>(K_CYLS, []);
export const saveCustomCylinders = (c: Cylinder[]) => write(K_CYLS, c);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
