import { describe, expect, it } from 'vitest';
import type { Project, Scene } from './types';
import { getSceneStartMs, getTotalDurationMs, resolvePosition } from './timeline';

function scene(id: string, duration: number): Scene {
  return { id, duration, layers: [] };
}

function project(scenes: Scene[]): Project {
  return {
    id: 'p',
    name: 'p',
    createdAt: 0,
    updatedAt: 0,
    aspectRatio: '16:9',
    resolution: { width: 1280, height: 720 },
    fps: 30,
    scenes,
    mediaLibrary: [],
  };
}

describe('getTotalDurationMs', () => {
  it('sums the duration of every scene', () => {
    const p = project([scene('a', 3000), scene('b', 2000)]);
    expect(getTotalDurationMs(p)).toBe(5000);
  });
});

describe('getSceneStartMs', () => {
  it('returns the cumulative start time of a scene', () => {
    const p = project([scene('a', 3000), scene('b', 2000), scene('c', 1000)]);
    expect(getSceneStartMs(p, 'a')).toBe(0);
    expect(getSceneStartMs(p, 'b')).toBe(3000);
    expect(getSceneStartMs(p, 'c')).toBe(5000);
  });
});

describe('resolvePosition', () => {
  const p = project([scene('a', 3000), scene('b', 2000)]);

  it('resolves a time inside the first scene', () => {
    const pos = resolvePosition(p, 1000);
    expect(pos?.scene.id).toBe('a');
    expect(pos?.sceneStartMs).toBe(0);
    expect(pos?.localTimeMs).toBe(1000);
  });

  it('resolves a time exactly on a scene boundary as the start of the next scene', () => {
    const pos = resolvePosition(p, 3000);
    expect(pos?.scene.id).toBe('b');
    expect(pos?.localTimeMs).toBe(0);
  });

  it('resolves a time inside the second scene', () => {
    const pos = resolvePosition(p, 4500);
    expect(pos?.scene.id).toBe('b');
    expect(pos?.localTimeMs).toBe(1500);
  });

  it('clamps a time past the end to the end of the last scene', () => {
    const pos = resolvePosition(p, 999_999);
    expect(pos?.scene.id).toBe('b');
    expect(pos?.localTimeMs).toBe(2000);
  });

  it('clamps a negative time to the start of the first scene', () => {
    const pos = resolvePosition(p, -500);
    expect(pos?.scene.id).toBe('a');
    expect(pos?.localTimeMs).toBe(0);
  });

  it('returns null for a project with no scenes', () => {
    expect(resolvePosition(project([]), 0)).toBeNull();
  });
});
