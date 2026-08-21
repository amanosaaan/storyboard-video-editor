import { alignPatch, bringToFrontPatch, rotatePatch, sendToBackPatch } from '../domain/arrange';
import type { AnimationConfig, AudioLayer, Layer, PhotoFilter, Project, Scene, ShapeLayer, TextLayer } from '../domain/types';
import { useProjectStore } from '../state/projectStore';
import { NumberField } from './NumberField';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignLeftIcon,
  AlignMiddleIcon,
  AlignRightIcon,
  AlignTopIcon,
  BringToFrontIcon,
  RotateLeftIcon,
  RotateRightIcon,
  SendToBackIcon,
  TrashIcon,
} from './icons';

function ArrangeGroup({ project, scene, layer }: { project: Project; scene: Scene; layer: Layer }) {
  const updateLayer = useProjectStore((s) => s.updateLayer);

  function bringToFront() {
    updateLayer(scene.id, layer.id, bringToFrontPatch(scene.layers));
  }

  function sendToBack() {
    updateLayer(scene.id, layer.id, sendToBackPatch(scene.layers));
  }

  function align(axis: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') {
    updateLayer(scene.id, layer.id, alignPatch(project, layer, axis));
  }

  function rotate(deltaDeg: number) {
    updateLayer(scene.id, layer.id, rotatePatch(layer, deltaDeg));
  }

  return (
    <div className="context-toolbar__group context-toolbar__group--arrange">
      <div className="context-toolbar__icon-row">
        <button className="context-toolbar__icon-btn" title="最前面へ" onClick={bringToFront}>
          <BringToFrontIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="最背面へ" onClick={sendToBack}>
          <SendToBackIcon />
        </button>
      </div>
      <div className="context-toolbar__icon-row">
        <button className="context-toolbar__icon-btn" title="左揃え" onClick={() => align('left')}>
          <AlignLeftIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="左右中央" onClick={() => align('centerH')}>
          <AlignCenterHIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="右揃え" onClick={() => align('right')}>
          <AlignRightIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="上揃え" onClick={() => align('top')}>
          <AlignTopIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="上下中央" onClick={() => align('centerV')}>
          <AlignMiddleIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="下揃え" onClick={() => align('bottom')}>
          <AlignBottomIcon />
        </button>
      </div>
      <div className="context-toolbar__icon-row">
        <button className="context-toolbar__icon-btn" title="反時計回りに90度回転" onClick={() => rotate(-90)}>
          <RotateLeftIcon />
        </button>
        <button className="context-toolbar__icon-btn" title="時計回りに90度回転" onClick={() => rotate(90)}>
          <RotateRightIcon />
        </button>
      </div>
    </div>
  );
}

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
    <div className="context-toolbar__group">
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
          周期(秒)
          <NumberField
            min={0.2}
            step={0.1}
            value={animation.durationMs / 1000}
            onChange={(v) => onChange({ ...animation, durationMs: Math.max(200, v * 1000) })}
          />
        </label>
      )}
    </div>
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
    <div className="context-toolbar__group">
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
    </div>
  );
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

interface Props {
  project: Project;
  scene: Scene;
  layer: Layer | undefined;
}

export function ContextToolbar({ project, scene, layer }: Props) {
  const sceneId = scene.id;
  const sceneDurationMs = scene.duration;
  const updateLayer = useProjectStore((s) => s.updateLayer);
  const removeLayer = useProjectStore((s) => s.removeLayer);

  if (!layer) return <div className="context-toolbar context-toolbar--empty" aria-hidden="true" />;

  const Arrange = <ArrangeGroup project={project} scene={scene} layer={layer} />;

  const DeleteButton = (
    <button className="btn-icon context-toolbar__delete" title="削除" onClick={() => removeLayer(sceneId, layer.id)}>
      <TrashIcon />
    </button>
  );

  if (layer.type === 'text') {
    return (
      <div className="context-toolbar">
        {Arrange}
        <textarea
          className="context-toolbar__text"
          value={layer.content}
          onChange={(e) => updateLayer(sceneId, layer.id, { content: e.target.value })}
        />
        <div className="context-toolbar__group">
          <label>
            サイズ
            <NumberField value={layer.fontSize} onChange={(v) => updateLayer(sceneId, layer.id, { fontSize: v })} min={1} />
          </label>
          <label>
            色
            <input type="color" value={layer.color} onChange={(e) => updateLayer(sceneId, layer.id, { color: e.target.value })} />
          </label>
          <label>
            配置
            <select
              value={layer.align}
              onChange={(e) => updateLayer(sceneId, layer.id, { align: e.target.value as TextLayer['align'] })}
            >
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </label>
        </div>
        <div className="context-toolbar__group">
          <label className="context-toolbar__checkbox">
            <input
              type="checkbox"
              checked={!!layer.backgroundColor}
              onChange={(e) =>
                updateLayer(sceneId, layer.id, { backgroundColor: e.target.checked ? 'rgba(0,0,0,0.6)' : undefined })
              }
            />
            背景ボックス
          </label>
          {layer.backgroundColor && (() => {
            const backgroundColor = layer.backgroundColor;
            return (
              <input
                type="color"
                value={rgbaToHex(backgroundColor)}
                onChange={(e) =>
                  updateLayer(sceneId, layer.id, { backgroundColor: hexToRgba(e.target.value, rgbaAlpha(backgroundColor)) })
                }
              />
            );
          })()}
        </div>
        <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(sceneId, layer.id, { animation: a })} />
        {DeleteButton}
      </div>
    );
  }

  if (layer.type === 'shape') {
    return (
      <div className="context-toolbar">
        {Arrange}
        <div className="context-toolbar__group">
          <label>
            種類
            <select
              value={layer.shape}
              onChange={(e) => updateLayer(sceneId, layer.id, { shape: e.target.value as ShapeLayer['shape'] })}
            >
              <option value="rect">矩形</option>
              <option value="circle">円</option>
              <option value="line">線</option>
            </select>
          </label>
          <label>
            塗り色
            <input type="color" value={layer.fill} onChange={(e) => updateLayer(sceneId, layer.id, { fill: e.target.value })} />
          </label>
          <label>
            線の色
            <input
              type="color"
              value={layer.stroke ?? '#000000'}
              onChange={(e) => updateLayer(sceneId, layer.id, { stroke: e.target.value })}
            />
          </label>
        </div>
        <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(sceneId, layer.id, { animation: a })} />
        {DeleteButton}
      </div>
    );
  }

  if (layer.type === 'video') {
    const asset = project.mediaLibrary.find((m) => m.id === layer.mediaId);
    const assetDurationSec = asset?.durationMs ? asset.durationMs / 1000 : undefined;
    const maxTrimStartSec = assetDurationSec !== undefined ? Math.max(0, assetDurationSec - sceneDurationMs / 1000) : undefined;
    return (
      <div className="context-toolbar">
        {Arrange}
        <div className="context-toolbar__group">
          <label>
            トリム開始(秒)
            <NumberField
              min={0}
              max={maxTrimStartSec}
              step={0.1}
              value={layer.trimStart / 1000}
              onChange={(v) => updateLayer(sceneId, layer.id, { trimStart: Math.max(0, v * 1000) })}
            />
          </label>
          <label>
            音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={layer.volume}
              onChange={(e) => updateLayer(sceneId, layer.id, { volume: Number(e.target.value) })}
            />
          </label>
          <label className="context-toolbar__checkbox">
            <input
              type="checkbox"
              checked={layer.muted}
              onChange={(e) => updateLayer(sceneId, layer.id, { muted: e.target.checked })}
            />
            ミュート
          </label>
        </div>
        <PhotoFilterControl filter={layer.filter} onChange={(f) => updateLayer(sceneId, layer.id, { filter: f })} />
        <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(sceneId, layer.id, { animation: a })} />
        {DeleteButton}
      </div>
    );
  }

  if (layer.type === 'image') {
    return (
      <div className="context-toolbar">
        {Arrange}
        <PhotoFilterControl filter={layer.filter} onChange={(f) => updateLayer(sceneId, layer.id, { filter: f })} />
        <AnimationControl animation={layer.animation} onChange={(a) => updateLayer(sceneId, layer.id, { animation: a })} />
        {DeleteButton}
      </div>
    );
  }

  // audio
  const asset = project.mediaLibrary.find((m) => m.id === layer.mediaId);
  const assetDurationSec = asset?.durationMs ? asset.durationMs / 1000 : undefined;
  const maxTrimStartSec = assetDurationSec !== undefined ? Math.max(0, assetDurationSec - sceneDurationMs / 1000) : undefined;
  return (
    <div className="context-toolbar">
      {Arrange}
      <div className="context-toolbar__group">
        <label>
          種類
          <select
            value={layer.role}
            onChange={(e) => updateLayer(sceneId, layer.id, { role: e.target.value as AudioLayer['role'] })}
          >
            <option value="music">BGM</option>
            <option value="voiceover">ボイスオーバー</option>
          </select>
        </label>
        <label>
          トリム開始(秒)
          <NumberField
            min={0}
            max={maxTrimStartSec}
            step={0.1}
            value={layer.trimStart / 1000}
            onChange={(v) => updateLayer(sceneId, layer.id, { trimStart: Math.max(0, v * 1000) })}
          />
        </label>
        <label>
          音量
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.volume}
            onChange={(e) => updateLayer(sceneId, layer.id, { volume: Number(e.target.value) })}
          />
        </label>
      </div>
      {DeleteButton}
    </div>
  );
}
