import { nanoid } from 'nanoid';
import { useState } from 'react';
import { computeCaptionPresetLayout } from '../domain/captionPreset';
import type {
  AnimationConfig,
  AudioLayer,
  Layer,
  PhotoFilter,
  Project,
  Scene,
  ShapeLayer,
  TextLayer,
  TransitionConfig,
} from '../domain/types';
import { useProjectStore } from '../state/projectStore';
import { CaptionIcon, RecordIcon, ShapeIcon, TextIcon, UploadIcon } from './icons';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { NumberField } from './NumberField';
import { RecordingPanel } from './RecordingPanel';

const ANIMATION_LABELS: Record<AnimationConfig['type'], string> = {
  pulse: 'パルス',
  spin: '回転',
  hover: 'ふわふわ',
  shake: 'シェイク',
  bounce: 'バウンド',
};

function AnimationControl({
  animation,
  onChange,
}: {
  animation: AnimationConfig | undefined;
  onChange: (animation: AnimationConfig | undefined) => void;
}) {
  return (
    <>
      <label>
        アニメーション
        <select
          value={animation?.type ?? 'none'}
          onChange={(e) => {
            const value = e.target.value;
            onChange(
              value === 'none'
                ? undefined
                : { type: value as AnimationConfig['type'], durationMs: animation?.durationMs ?? 1500 },
            );
          }}
        >
          <option value="none">なし</option>
          {(Object.keys(ANIMATION_LABELS) as AnimationConfig['type'][]).map((type) => (
            <option key={type} value={type}>
              {ANIMATION_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      {animation && (
        <label>
          周期 (秒)
          <NumberField
            min={0.2}
            step={0.1}
            value={animation.durationMs / 1000}
            onChange={(v) => onChange({ ...animation, durationMs: Math.max(200, v * 1000) })}
          />
        </label>
      )}
    </>
  );
}

function PhotoFilterControl({
  filter,
  onChange,
}: {
  filter: PhotoFilter | undefined;
  onChange: (filter: PhotoFilter) => void;
}) {
  const current = filter ?? { brightness: 100, contrast: 100 };
  return (
    <>
      <label>
        明るさ ({current.brightness}%)
        <input
          type="range"
          min={40}
          max={160}
          value={current.brightness}
          onChange={(e) => onChange({ ...current, brightness: Number(e.target.value) })}
        />
      </label>
      <label>
        コントラスト ({current.contrast}%)
        <input
          type="range"
          min={40}
          max={160}
          value={current.contrast}
          onChange={(e) => onChange({ ...current, contrast: Number(e.target.value) })}
        />
      </label>
    </>
  );
}

interface Props {
  project: Project;
  scene: Scene;
}

function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return '#000000';
  const [, r, g, b] = match;
  return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

function rgbaAlpha(rgba: string): number {
  const match = rgba.match(/rgba\([^)]+,\s*([\d.]+)\s*\)/);
  return match ? Number(match[1]) : 1;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const removeLayer = useProjectStore((s) => s.removeLayer);
  const addLayerToScene = useProjectStore((s) => s.addLayerToScene);
  const updateSceneDuration = useProjectStore((s) => s.updateSceneDuration);
  const updateScene = useProjectStore((s) => s.updateScene);

  const layer = scene.layers.find((l) => l.id === selectedLayerId);
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
    const index = sortedLayers.findIndex((l) => l.id === target.id);
    const neighborIndex = direction === 'front' ? index - 1 : index + 1;
    const neighbor = sortedLayers[neighborIndex];
    if (!neighbor) return;
    updateLayer(scene.id, target.id, { zIndex: neighbor.zIndex });
    updateLayer(scene.id, neighbor.id, { zIndex: target.zIndex });
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
        <label>
          次のシーンへのトランジション
          <select
            value={scene.transitionOut?.type ?? 'none'}
            onChange={(e) => {
              const value = e.target.value;
              updateScene(scene.id, {
                transitionOut:
                  value === 'none'
                    ? undefined
                    : { type: value as TransitionConfig['type'], durationMs: scene.transitionOut?.durationMs ?? 600 },
              });
            }}
          >
            <option value="none">なし</option>
            <option value="crossfade">クロスフェード</option>
            <option value="slide">スライド</option>
            <option value="wipe">ワイプ</option>
          </select>
        </label>
        {scene.transitionOut && (() => {
          const transitionOut = scene.transitionOut;
          return (
            <label>
              トランジションの長さ (秒)
              <NumberField
                min={0.1}
                max={Math.max(0.1, scene.duration / 1000)}
                step={0.1}
                value={transitionOut.durationMs / 1000}
                onChange={(v) => updateScene(scene.id, { transitionOut: { ...transitionOut, durationMs: Math.max(100, v * 1000) } })}
              />
            </label>
          );
        })()}
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

      {layer && layer.type === 'text' && (
        <div className="inspector__section">
          <h3>テキスト</h3>
          <textarea value={layer.content} onChange={(e) => updateLayer(scene.id, layer.id, { content: e.target.value })} />
          <label>
            サイズ
            <NumberField value={layer.fontSize} onChange={(v) => updateLayer(scene.id, layer.id, { fontSize: v })} min={1} />
          </label>
          <label>
            色
            <input type="color" value={layer.color} onChange={(e) => updateLayer(scene.id, layer.id, { color: e.target.value })} />
          </label>
          <label>
            配置
            <select
              value={layer.align}
              onChange={(e) => updateLayer(scene.id, layer.id, { align: e.target.value as TextLayer['align'] })}
            >
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!layer.backgroundColor}
              onChange={(e) =>
                updateLayer(scene.id, layer.id, { backgroundColor: e.target.checked ? 'rgba(0,0,0,0.6)' : undefined })
              }
            />
            背景ボックスを表示（字幕向け）
          </label>
          {layer.backgroundColor && (() => {
            const backgroundColor = layer.backgroundColor;
            return (
              <label>
                背景色
                <input
                  type="color"
                  value={rgbaToHex(backgroundColor)}
                  onChange={(e) =>
                    updateLayer(scene.id, layer.id, { backgroundColor: hexToRgba(e.target.value, rgbaAlpha(backgroundColor)) })
                  }
                />
              </label>
            );
          })()}
          <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(scene.id, layer.id, { animation: a })} />
          <button onClick={() => removeLayer(scene.id, layer.id)}>削除</button>
        </div>
      )}

      {layer && layer.type === 'shape' && (
        <div className="inspector__section">
          <h3>図形</h3>
          <label>
            種類
            <select
              value={layer.shape}
              onChange={(e) => updateLayer(scene.id, layer.id, { shape: e.target.value as ShapeLayer['shape'] })}
            >
              <option value="rect">矩形</option>
              <option value="circle">円</option>
              <option value="line">線</option>
            </select>
          </label>
          <label>
            塗り色
            <input type="color" value={layer.fill} onChange={(e) => updateLayer(scene.id, layer.id, { fill: e.target.value })} />
          </label>
          <label>
            線の色
            <input
              type="color"
              value={layer.stroke ?? '#000000'}
              onChange={(e) => updateLayer(scene.id, layer.id, { stroke: e.target.value })}
            />
          </label>
          <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(scene.id, layer.id, { animation: a })} />
          <button onClick={() => removeLayer(scene.id, layer.id)}>削除</button>
        </div>
      )}

      {layer && layer.type === 'video' && (() => {
        const asset = project.mediaLibrary.find((m) => m.id === layer.mediaId);
        const assetDurationSec = asset?.durationMs ? asset.durationMs / 1000 : undefined;
        const maxTrimStartSec =
          assetDurationSec !== undefined ? Math.max(0, assetDurationSec - scene.duration / 1000) : undefined;
        return (
          <div className="inspector__section">
            <h3>動画</h3>
            {assetDurationSec !== undefined && (
              <p className="inspector__hint">元動画の長さ: {assetDurationSec.toFixed(1)}秒</p>
            )}
            <label>
              トリム開始位置 (秒)
              <NumberField
                min={0}
                max={maxTrimStartSec}
                step={0.1}
                value={layer.trimStart / 1000}
                onChange={(v) => updateLayer(scene.id, layer.id, { trimStart: Math.max(0, v * 1000) })}
              />
            </label>
            <p className="inspector__hint">シーンの長さ分（上の「シーンの長さ」）だけ、この位置から再生されます。</p>
            <label>
              音量
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layer.volume}
                onChange={(e) => updateLayer(scene.id, layer.id, { volume: Number(e.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={layer.muted}
                onChange={(e) => updateLayer(scene.id, layer.id, { muted: e.target.checked })}
              />
              ミュート
            </label>
            <PhotoFilterControl filter={layer.filter} onChange={(f) => updateLayer(scene.id, layer.id, { filter: f })} />
            <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(scene.id, layer.id, { animation: a })} />
            <button onClick={() => removeLayer(scene.id, layer.id)}>削除</button>
          </div>
        );
      })()}

      {layer && layer.type === 'image' && (
        <div className="inspector__section">
          <h3>画像</h3>
          <PhotoFilterControl filter={layer.filter} onChange={(f) => updateLayer(scene.id, layer.id, { filter: f })} />
          <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(scene.id, layer.id, { animation: a })} />
          <button onClick={() => removeLayer(scene.id, layer.id)}>削除</button>
        </div>
      )}

      {layer && layer.type === 'audio' && (() => {
        const asset = project.mediaLibrary.find((m) => m.id === layer.mediaId);
        const assetDurationSec = asset?.durationMs ? asset.durationMs / 1000 : undefined;
        const maxTrimStartSec =
          assetDurationSec !== undefined ? Math.max(0, assetDurationSec - scene.duration / 1000) : undefined;
        return (
          <div className="inspector__section">
            <h3>音声</h3>
            {assetDurationSec !== undefined && (
              <p className="inspector__hint">元音声の長さ: {assetDurationSec.toFixed(1)}秒</p>
            )}
            <label>
              種類
              <select
                value={layer.role}
                onChange={(e) => updateLayer(scene.id, layer.id, { role: e.target.value as AudioLayer['role'] })}
              >
                <option value="music">BGM</option>
                <option value="voiceover">ボイスオーバー</option>
              </select>
            </label>
            <label>
              トリム開始位置 (秒)
              <NumberField
                min={0}
                max={maxTrimStartSec}
                step={0.1}
                value={layer.trimStart / 1000}
                onChange={(v) => updateLayer(scene.id, layer.id, { trimStart: Math.max(0, v * 1000) })}
              />
            </label>
            <p className="inspector__hint">シーンの長さ分（上の「シーンの長さ」）だけ、この位置から再生されます。</p>
            <label>
              音量
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layer.volume}
                onChange={(e) => updateLayer(scene.id, layer.id, { volume: Number(e.target.value) })}
              />
            </label>
            <button onClick={() => removeLayer(scene.id, layer.id)}>削除</button>
          </div>
        );
      })()}

      {isMediaOpen && <MediaLibraryPanel project={project} targetSceneId={scene.id} onClose={() => setMediaOpen(false)} />}
      {isRecordingOpen && <RecordingPanel project={project} onClose={() => setRecordingOpen(false)} />}
    </div>
  );
}
