import { useRef, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react';
import { getLayerVisibleRange } from '../domain/layerTiming';
import type { Layer, Scene } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { useProjectStore } from '../state/projectStore';
import { AudioIcon, CloseIcon, ImageIcon, ShapeCircleIcon, ShapeLineIcon, ShapeRectIcon, TextIcon, VideoIcon } from './icons';

function layerTypeMeta(layer: Layer): { Icon: ComponentType<{ size?: number }>; label: string } {
  switch (layer.type) {
    case 'video':
      return { Icon: VideoIcon, label: '動画' };
    case 'image':
      return { Icon: ImageIcon, label: '画像' };
    case 'audio':
      return { Icon: AudioIcon, label: '音声' };
    case 'text':
      return { Icon: TextIcon, label: 'テキスト' };
    case 'shape':
      switch (layer.shape) {
        case 'circle':
          return { Icon: ShapeCircleIcon, label: '円' };
        case 'line':
          return { Icon: ShapeLineIcon, label: '線' };
        default:
          return { Icon: ShapeRectIcon, label: '長方形' };
      }
  }
}

function LayerTrackLabel({
  layer,
  isSelected,
  onSelect,
}: {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { Icon, label } = layerTypeMeta(layer);
  return (
    <button
      type="button"
      className={`layer-track-row__label${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

function LayerTrackLane({
  layer,
  sceneDurationMs,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: Layer;
  sceneDurationMs: number;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: { startMs?: number; endMs?: number }) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { start, end } = getLayerVisibleRange(layer, sceneDurationMs);
  const hasCustomRange = layer.startMs !== undefined || layer.endMs !== undefined;
  const startPct = sceneDurationMs > 0 ? (start / sceneDurationMs) * 100 : 0;
  const endPct = sceneDurationMs > 0 ? (end / sceneDurationMs) * 100 : 100;

  function msFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * sceneDurationMs);
  }

  function startDrag(handle: 'start' | 'end') {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      const boundary = handle === 'start' ? end : start;
      const move = (ev: PointerEvent) => {
        const ms = msFromClientX(ev.clientX);
        if (handle === 'start') onChange({ startMs: Math.min(ms, boundary) });
        else onChange({ endMs: Math.max(ms, boundary) });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  }

  return (
    <div className={`layer-track-row__lane${isSelected ? ' is-selected' : ''}`}>
      <div className="layer-track-row__track" ref={trackRef} onClick={onSelect}>
        <div className="layer-track-row__bar" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}>
          <div className="layer-track-row__handle layer-track-row__handle--start" onPointerDown={startDrag('start')} />
          <div className="layer-track-row__handle layer-track-row__handle--end" onPointerDown={startDrag('end')} />
        </div>
      </div>
      {hasCustomRange && (
        <button
          type="button"
          className="layer-track-row__reset"
          title="全体表示に戻す"
          onClick={() => onChange({ startMs: undefined, endMs: undefined })}
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
}

interface Props {
  scene: Scene;
  engine: ProjectPlaybackEngine;
}

/**
 * シーン内の各レイヤーの表示タイミングを一覧表示・編集するトラックパネル。
 * 本家Google Vidsのシーン詳細タイムラインに準拠し、PC・スマホ共通で使う。
 * レイヤー種類ごとに1行、シーンの長さを基準にしたバーで表示区間を示し、
 * バー端をドラッグして開始/終了時刻を変更できる。
 */
export function LayerTimelinePanel({ scene, engine }: Props) {
  const selectedLayerIds = useProjectStore((s) => s.selectedLayerIds);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const updateLayer = useProjectStore((s) => s.updateLayer);

  if (scene.layers.length === 0) {
    return <div className="layer-track-panel layer-track-panel--empty">このシーンにはまだ要素がありません</div>;
  }

  const rows = [...scene.layers].reverse();
  const showPlayhead = engine.position?.scene.id === scene.id;
  const playheadPct = showPlayhead ? (engine.position!.localTimeMs / Math.max(1, scene.duration)) * 100 : 0;

  return (
    <div className="layer-track-panel">
      <div className="layer-track-panel__labels">
        {rows.map((layer) => (
          <LayerTrackLabel
            key={layer.id}
            layer={layer}
            isSelected={selectedLayerIds.includes(layer.id)}
            onSelect={() => selectLayer(layer.id)}
          />
        ))}
      </div>
      <div className="layer-track-panel__lanes">
        {showPlayhead && <div className="layer-track-panel__playhead" style={{ left: `${playheadPct}%` }} />}
        {rows.map((layer) => (
          <LayerTrackLane
            key={layer.id}
            layer={layer}
            sceneDurationMs={scene.duration}
            isSelected={selectedLayerIds.includes(layer.id)}
            onSelect={() => selectLayer(layer.id)}
            onChange={(patch) => updateLayer(scene.id, layer.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}
