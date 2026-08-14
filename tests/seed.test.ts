import { describe, expect, it } from 'vitest';
import { seed } from '../src/seed.js';

describe('seed', () => {
  it('adds two numbers', () => {
    expect(seed(2, 3)).toBe(5);
    expect(seed(-1, 1)).toBe(0);
  });
});
