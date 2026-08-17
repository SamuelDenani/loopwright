/**
 * Single source of truth for engine paths. The engine lives vendored at
 * <host>/.loopwright/, so every location derives from this file's own.
 */
import { resolve } from 'node:path';

export const SCRIPTS_DIR = resolve(import.meta.dirname, '..');
export const LOOPWRIGHT_DIR = resolve(SCRIPTS_DIR, '..');
export const HOST_ROOT = resolve(LOOPWRIGHT_DIR, '..');
export const REPORTS_DIR = resolve(LOOPWRIGHT_DIR, 'reports');
export const CONFIG_PATH = resolve(LOOPWRIGHT_DIR, 'config.json');
export const BASELINE_PATH = resolve(LOOPWRIGHT_DIR, 'baseline.json');
