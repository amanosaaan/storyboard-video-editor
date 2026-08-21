import { nanoid } from 'nanoid';
import { computeCaptionPresetLayout } from './captionPreset';
import type { Project, Scene, ShapeLayer, TextLayer } from './types';

export function createTextLayer(scene: Scene): TextLayer {
  return {
    id: nanoid(),
    type: 'text',
    content: 'テキスト',
    x: 40,
    y: 40,
    width: 400,
    height: 80,
    rotation: 0,
    opacity: 1,
    zIndex: scene.layers.length + 1,
    fontFamily: 'sans-serif',
    fontSize: 40,
    color: '#ffffff',
    fontWeight: 'bold',
    align: 'left',
  };
}

export function createCaptionLayer(project: Project, scene: Scene): TextLayer {
  const { x, y, width, height, fontSize } = computeCaptionPresetLayout(project.resolution);
  return {
    id: nanoid(),
    type: 'text',
    content: '字幕テキスト',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    zIndex: scene.layers.length + 1,
    fontFamily: 'sans-serif',
    fontSize,
    color: '#ffffff',
    fontWeight: 'bold',
    align: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  };
}

export function createShapeLayer(scene: Scene): ShapeLayer {
  return {
    id: nanoid(),
    type: 'shape',
    shape: 'rect',
    fill: '#1a73e8',
    x: 60,
    y: 60,
    width: 200,
    height: 120,
    rotation: 0,
    opacity: 1,
    zIndex: scene.layers.length + 1,
  };
}
