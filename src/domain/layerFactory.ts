import { nanoid } from 'nanoid';
import { computeCaptionPresetLayout } from './captionPreset';
import type { ImageLayer, Project, Scene, ShapeLayer, TextLayer, VideoLayer } from './types';

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

/**
 * シーンに動画/画像レイヤーを配置する際の位置・サイズ・zIndexを決める。
 * まだ動画/画像が1つも無いシーンでは画面全体（背景）として配置し、
 * 既に動画/画像がある場合は重ねて隠してしまわないよう中央に縮小して配置する。
 */
function visualLayerBounds(project: Project, scene: Scene) {
  const hasVisual = scene.layers.some((l) => l.type === 'video' || l.type === 'image');
  const zIndex = scene.layers.length > 0 ? Math.max(...scene.layers.map((l) => l.zIndex)) + 1 : 1;
  if (!hasVisual) {
    return { x: 0, y: 0, width: project.resolution.width, height: project.resolution.height, zIndex, isMain: true };
  }
  const width = project.resolution.width * 0.5;
  const height = project.resolution.height * 0.5;
  return {
    x: (project.resolution.width - width) / 2,
    y: (project.resolution.height - height) / 2,
    width,
    height,
    zIndex,
    isMain: false,
  };
}

export function createImageLayerForScene(project: Project, scene: Scene, mediaId: string): ImageLayer {
  const { x, y, width, height, zIndex } = visualLayerBounds(project, scene);
  return { id: nanoid(), type: 'image', mediaId, x, y, width, height, rotation: 0, opacity: 1, zIndex };
}

export function createVideoLayerForScene(
  project: Project,
  scene: Scene,
  mediaId: string,
): { layer: VideoLayer; isMain: boolean } {
  const { x, y, width, height, zIndex, isMain } = visualLayerBounds(project, scene);
  const layer: VideoLayer = {
    id: nanoid(),
    type: 'video',
    mediaId,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    zIndex,
    trimStart: 0,
    volume: 1,
    muted: false,
  };
  return { layer, isMain };
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
