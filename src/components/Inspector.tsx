import { nanoid } from 'nanoid';
import { useState } from 'react';
import { stepZIndexPatches } from '../domain/arrange';
import { computeCaptionPresetLayout } from '../domain/captionPreset';
import type { Layer, Project, Scene, ShapeLayer, TextLayer } from '../domain/types';
import { useProjectStore } from '../state/projectStore';
import { CaptionIcon, RecordIcon, ShapeIcon, TextIcon, UploadIcon } from './icons';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { NumberField } from './NumberField';
import { RecordingPanel } from './RecordingPanel';

interface Props {
  project: Project;
  scene: Scene;
}

function layerLabel(layer: Layer): string {
  switch (layer.type) {
    case 'text':
      return layer.content.trim() ? `テキスト: ${layer.content.slice(0, 12)}` : 'テキスト';
    case 'shape':
      return `図形 (${{ rect: '矩形', circle: '円', line: '線' }[layer.shape]})`;
    case 'video':
      return '動画';
    case 'image':
      return '画像';
    case 'audio':
      return `音声 (${layer.role === 'music' ? 'BGM' : 'ボイスオーバー'})`;
  }
}

export function Inspector({ project, scene }: Props) {
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [isRecordingOpen, setRecordingOpen] = useState(false);
  const selectedLayerId = useProjectStore((s) => s.selectedLayerId);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const updateLayer = useProjectStore((s) => s.updateLayer);
  const addLayerToScene = useProjectStore((s) => s.addLayerToScene);
  const updateSceneDuration = useProjectStore((s) => s.updateSceneDuration);

  const sortedLayers = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex);

  function addTextLayer() {
    const newLayer: TextLayer = {
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
    addLayerToScene(scene.id, newLayer);
  }

  function addCaptionLayer() {
    const { x, y, width, height, fontSize } = computeCaptionPresetLayout(project.resolution);
    const newLayer: TextLayer = {
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
    addLayerToScene(scene.id, newLayer);
  }

  function addShapeLayer() {
    const newLayer: ShapeLayer = {
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
    addLayerToScene(scene.id, newLayer);
  }

  function moveLayer(target: Layer, direction: 'front' | 'back') {
    const result = stepZIndexPatches(scene.layers, target, direction === 'front' ? 'forward' : 'backward');
    if (!result) return;
    updateLayer(scene.id, target.id, result.targetPatch);
    updateLayer(scene.id, result.neighborId, result.neighborPatch);
  }

  return (
    <div className="panel inspector">
      <h2>設定</h2>
      <div className="inspector__section">
        <label>
          シーンの長さ (秒)
          <NumberField
            min={0.5}
            step={0.5}
            value={scene.duration / 1000}
            onChange={(v) => updateSceneDuration(scene.id, Math.max(500, v * 1000))}
          />
        </label>
      </div>

      <div className="inspector__section">
        <div className="insert-rail">
          <button className="insert-rail__button" onClick={() => setMediaOpen(true)}>
            <UploadIcon />
            <span>アップロード</span>
          </button>
          <button className="insert-rail__button" onClick={() => setRecordingOpen(true)}>
            <RecordIcon />
            <span>録画</span>
          </button>
          <button className="insert-rail__button" onClick={addShapeLayer}>
            <ShapeIcon />
            <span>図形</span>
          </button>
          <button className="insert-rail__button" onClick={addTextLayer}>
            <TextIcon />
            <span>テキスト</span>
          </button>
          <button className="insert-rail__button" onClick={addCaptionLayer}>
            <CaptionIcon />
            <span>字幕</span>
          </button>
        </div>
        {sortedLayers.length > 0 && (
          <ul className="layer-list">
            {sortedLayers.map((l, i) => (
              <li key={l.id} className={`layer-list__item${l.id === selectedLayerId ? ' is-selected' : ''}`}>
                <button className="layer-list__select" onClick={() => selectLayer(l.id)}>
                  {layerLabel(l)}
                </button>
                <button title="前面へ" disabled={i === 0} onClick={() => moveLayer(l, 'front')}>
                  ▲
                </button>
                <button title="背面へ" disabled={i === sortedLayers.length - 1} onClick={() => moveLayer(l, 'back')}>
                  ▼
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isMediaOpen && <MediaLibraryPanel project={project} targetSceneId={scene.id} onClose={() => setMediaOpen(false)} />}
      {isRecordingOpen && <RecordingPanel project={project} onClose={() => setRecordingOpen(false)} />}
    </div>
  );
}
