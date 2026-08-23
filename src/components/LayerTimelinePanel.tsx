import { useRef, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react';
import { getLayerVisibleRange } from '../domain/layerTiming';
import { getSceneStartMs } from '../domain/timeline';
import type { Project, Layer, Scene } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { useProjectStore } from '../state/projectStore';
import { AudioIcon, CloseIcon, ImageIcon, ShapeCircleIcon, ShapeLineIcon, ShapeRectIcon, TextIcon, VideoIcon } from './icons';

function formatSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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

/**
 * シーン切り替え用の縮小チップ列。現在のシーンだけをこの下のトラック列と
 * 同じ幅まで広げ、他のシーンは番号だけの小さいチップにする。
 * SceneTimelineStrip(全体の一覧・シークバー)とは別の、この詳細パネル専用の
 * 簡易セレクタ。lanes列(flexカラム)の中の1行として置くことで、
 * ルーラーやレイヤー行と幅がぴったり揃う(JS側で幅を計算する必要がない)。
 */
function SceneChipRow({ project, scene, engine }: { project: Project; scene: Scene; engine: ProjectPlaybackEngine }) {
  return (
    <div className="layer-track-row__lane">
      <div className="layer-track-panel__chiprow">
        {project.scenes.map((s, i) =>
          s.id === scene.id ? (
            <div key={s.id} className="layer-track-panel__chip layer-track-panel__chip--active">
              {i + 1}
            </div>
          ) : (
            <button
              key={s.id}
              type="button"
              className="layer-track-panel__chip"
              onClick={() => engine.seek(getSceneStartMs(project, s.id))}
            >
              {i + 1}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function SceneRuler({
  scene,
  project,
  engine,
}: {
  scene: Scene;
  project: Project;
  engine: ProjectPlaybackEngine;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  function seekFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    engine.seek(getSceneStartMs(project, scene.id) + ratio * scene.duration);
  }

  return (
    <div className="layer-track-row__lane">
      <div
        className="layer-track-row__ruler"
        ref={trackRef}
        onPointerDown={(e) => seekFromClientX(e.clientX)}
      >
        <span>0:00</span>
        <span>{formatSec(scene.duration)}</span>
      </div>
    </div>
  );
}

interface Props {
  scene: Scene;
  project: Project;
  engine: ProjectPlaybackEngine;
}

/**
 * シーン内の各レイヤーの表示タイミングを一覧表示・編集するトラックパネル。
 * 本家Google Vidsのシーン詳細タイムラインに準拠し、PC・スマホ共通で使う。
 * レイヤー種類ごとに1行、シーンの長さを基準にしたバーで表示区間を示し、
 * バー端をドラッグして開始/終了時刻を変更できる。
 */
export function LayerTimelinePanel({ scene, project, engine }: Props) {
  const selectedLayerIds = useProjectStore((s) => s.selectedLayerIds);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const updateLayer = useProjectStore((s) => s.updateLayer);

  const rows = [...scene.layers].reverse();
  const showPlayhead = engine.position?.scene.id === scene.id;
  const playheadPct = showPlayhead ? (engine.position!.localTimeMs / Math.max(1, scene.duration)) * 100 : 0;

  return (
    <div className="layer-track-panel">
      <div className="layer-track-panel__labels">
        <div className="layer-track-row__label layer-track-row__label--ruler" aria-hidden="true" />
        <div className="layer-track-row__label layer-track-row__label--ruler" aria-hidden="true" />
        {rows.length === 0 && <div className="layer-track-row__label layer-track-row__label--ruler" aria-hidden="true" />}
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
        <SceneChipRow project={project} scene={scene} engine={engine} />
        <SceneRuler scene={scene} project={project} engine={engine} />
        {rows.length === 0 && (
          <div className="layer-track-row__lane">
            <p className="layer-track-panel__hint">このシーンにはまだ要素がありません</p>
          </div>
        )}
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
