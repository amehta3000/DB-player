import { describe, expect, it } from 'vitest';
import { nextPos } from '../src/lib/usePlayer';

describe('nextPos', () => {
  it('advances through the queue', () => {
    expect(nextPos(4, 0, 'off', true)).toBe(1);
    expect(nextPos(4, 2, 'off', true)).toBe(3);
  });

  it('stops at the end when a track ends and repeat is off', () => {
    expect(nextPos(4, 3, 'off', true)).toBeNull();
  });

  it('wraps at the end with repeat all, or when the user presses next', () => {
    expect(nextPos(4, 3, 'all', true)).toBe(0);
    expect(nextPos(4, 3, 'off', false)).toBe(0);
  });

  it('handles an empty queue', () => {
    expect(nextPos(0, -1, 'off', true)).toBeNull();
  });
});
