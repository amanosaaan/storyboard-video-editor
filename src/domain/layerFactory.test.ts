import { describe, expect, it } from 'vitest';
import { createImageLayerForScene, createVideoLayerForScene } from './layerFactory';
import type { MediaAsset, Project, Scene } from './types';

function makeProject(): Project {
  return {
    id: 'p1',
    name: 'test',
    createdAt: 0,
    updatedAt: 0,
    aspectRatio: '16:9',
    resolution: { width: 1280, height: 720 },
    fps: 30,
    scenes: [],
    mediaLibrary: [],
  };
}

function makeScene(layers: Scene['layers'] = []): Scene {
  return { id: 's1', duration: 5000, layers };
}

function makeAsset(width?: number, height?: number): MediaAsset {
  return { id: 'a1', kind: 'image', name: 'x.png', width, height, createdAt: 0, sizeBytes: 0 };
}

describe('createImageLayerForScene', () => {
  it('does not stretch a wide image: fills full width, letterboxes top/bottom, in an empty scene', () => {
    const project = makeProject();
    const scene = makeScene();
    const asset = makeAsset(400, 200); // 2:1, wider than the 16:9 canvas
    const layer = createImageLayerForScene(project, scene, asset);

    expect(layer.width).toBeCloseTo(1280);
    expect(layer.height).toBeLessThan(720);
    expect(layer.height / layer.width).toBeCloseTo(200 / 400);
    // 縦方向に中央寄せされていること
    expect(layer.y).toBeCloseTo((720 - layer.height) / 2);
    expect(layer.x).toBeCloseTo(0);
  });

  it('does not stretch a tall image: fills full height, pillarboxes left/right', () => {
    const project = makeProject();
    const scene = makeScene();
    const asset = makeAsset(100, 400); // 1:4, taller than the 16:9 canvas
    const layer = createImageLayerForScene(project, scene, asset);

    expect(layer.height).toBeCloseTo(720);
    expect(layer.width).toBeLessThan(1280);
    expect(layer.width / layer.height).toBeCloseTo(100 / 400);
    expect(layer.x).toBeCloseTo((1280 - layer.width) / 2);
  });

  it('keeps aspect ratio when placed as an overlay on top of an existing visual layer', () => {
    const project = makeProject();
    const scene = makeScene([
      { id: 'existing', type: 'image', mediaId: 'other', x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1, zIndex: 1 },
    ]);
    const asset = makeAsset(400, 200);
    const layer = createImageLayerForScene(project, scene, asset);

    // 中央半分の範囲(640x360)に収まり、かつ縦横比が保たれていること
    expect(layer.width).toBeLessThanOrEqual(640 + 0.01);
    expect(layer.height).toBeLessThanOrEqual(360 + 0.01);
    expect(layer.height / layer.width).toBeCloseTo(200 / 400);
    expect(layer.zIndex).toBeGreaterThan(1);
  });

  it('falls back to filling the available bounds when the asset has no known dimensions', () => {
    const project = makeProject();
    const scene = makeScene();
    const asset = makeAsset(undefined, undefined);
    const layer = createImageLayerForScene(project, scene, asset);

    expect(layer.width).toBe(1280);
    expect(layer.height).toBe(720);
  });
});

describe('createVideoLayerForScene', () => {
  it('preserves aspect ratio for the main (first) video and reports isMain', () => {
    const project = makeProject();
    const scene = makeScene();
    const asset = makeAsset(400, 200);
    const { layer, isMain } = createVideoLayerForScene(project, scene, asset);

    expect(isMain).toBe(true);
    expect(layer.width).toBeCloseTo(1280);
    expect(layer.height / layer.width).toBeCloseTo(200 / 400);
  });
});
