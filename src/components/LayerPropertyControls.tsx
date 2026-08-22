import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AnimationConfig, BaseLayer, PhotoFilter } from '../domain/types';
import { TimerIcon } from './icons';
import { NumberField } from './NumberField';

const ANIMATION_GROUPS: { label: string; types: AnimationConfig['type'][] }[] = [
  { label: 'ループ', types: ['pulse', 'spin', 'hover', 'shake', 'bounce'] },
  { label: '登場', types: ['pop', 'rise', 'typewriter'] },
];

const ANIMATION_LABELS: Record<AnimationConfig['type'], string> = {
  pulse: 'パルス',
  spin: '回転',
  hover: 'ふわふわ',
  shake: 'シェイク',
  bounce: 'バウンド',
  pop: 'ポップ',
  rise: 'ライズ',
  typewriter: 'タイプライター',
};

/** ループ系は「1周期の長さ」、登場系は「登場にかかる時間」を表す。ラベルを出し分ける。 */
const ENTRANCE_TYPES: AnimationConfig['type'][] = ['pop', 'rise', 'typewriter'];
/** 詳細調整(強さ)が意味を持たないアニメーション種別。 */
const NO_INTENSITY_TYPES: AnimationConfig['type'][] = ['spin', 'typewriter'];

export function AnimationControl({
  animation,
  onChange,
}: {
  animation: AnimationConfig | undefined;
  onChange: (animation: AnimationConfig | undefined) => void;
}) {
  const isEntrance = animation ? ENTRANCE_TYPES.includes(animation.type) : false;
  const showIntensity = animation ? !NO_INTENSITY_TYPES.includes(animation.type) : false;
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
                : {
                    type: value as AnimationConfig['type'],
                    durationMs: animation?.durationMs ?? (ENTRANCE_TYPES.includes(value as AnimationConfig['type']) ? 600 : 1500),
                    intensity: animation?.intensity ?? 50,
                  },
            );
          }}
        >
          <option value="none">なし</option>
          {ANIMATION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map((type) => (
                <option key={type} value={type}>
                  {ANIMATION_LABELS[type]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {animation && (
        <label>
          {isEntrance ? '登場の速さ(秒)' : '周期(秒)'}
          <NumberField
            min={0.1}
            step={0.1}
            value={animation.durationMs / 1000}
            onChange={(v) => onChange({ ...animation, durationMs: Math.max(100, v * 1000) })}
          />
        </label>
      )}
      {animation && showIntensity && (
        <label>
          強さ ({animation.intensity ?? 50}%)
          <input
            type="range"
            min={0}
            max={100}
            value={animation.intensity ?? 50}
            onChange={(e) => onChange({ ...animation, intensity: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}

export function PhotoFilterControl({
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

/** タイミングバーの操作対象。表示区間(startMs/endMs)を持つ全レイヤー種別で共通利用する。 */
type TimingSource = Pick<BaseLayer, 'startMs' | 'endMs'>;

/**
 * レイヤーがシーン内で表示される区間(表示タイミング)を表示・編集するコントロール。
 * 本家Google Vidsと同様、常時表示すると煩雑になるため、時計アイコンで折りたたみ・展開できる。
 */
export function LayerTimingControl({
  layer,
  sceneDurationMs,
  onChange,
}: {
  layer: TimingSource;
  sceneDurationMs: number;
  onChange: (patch: TimingSource) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const start = layer.startMs ?? 0;
  const end = layer.endMs ?? sceneDurationMs;
  const hasCustomRange = layer.startMs !== undefined || layer.endMs !== undefined;
  const durationSec = sceneDurationMs / 1000;

  function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setFlyoutPos({ left: rect.left + rect.width / 2, top: rect.top });
    setExpanded(true);
  }

  const msFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * sceneDurationMs);
    },
    [sceneDurationMs],
  );

  function startDrag(handle: 'start' | 'end') {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
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

  const startPct = sceneDurationMs > 0 ? (start / sceneDurationMs) * 100 : 0;
  const endPct = sceneDurationMs > 0 ? (end / sceneDurationMs) * 100 : 100;

  return (
    <div className="context-toolbar__group layer-timing">
      <button
        ref={buttonRef}
        className={`context-toolbar__icon-btn${hasCustomRange ? ' is-active' : ''}`}
        title="表示タイミング"
        onClick={toggle}
      >
        <TimerIcon size={16} />
      </button>
      {expanded &&
        flyoutPos &&
        createPortal(
          <>
            <div className="layer-timing__backdrop" onClick={() => setExpanded(false)} />
            <div
              className="layer-timing__panel"
              style={{ left: flyoutPos.left, top: flyoutPos.top }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="layer-timing__track" ref={trackRef}>
                <div className="layer-timing__range" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
                <div className="layer-timing__handle" style={{ left: `${startPct}%` }} onPointerDown={startDrag('start')} />
                <div className="layer-timing__handle" style={{ left: `${endPct}%` }} onPointerDown={startDrag('end')} />
              </div>
              <div className="layer-timing__fields">
                <label>
                  開始(秒)
                  <NumberField
                    min={0}
                    max={durationSec}
                    step={0.1}
                    value={start / 1000}
                    onChange={(v) => onChange({ startMs: Math.min(Math.max(0, v * 1000), end) })}
                  />
                </label>
                <label>
                  終了(秒)
                  <NumberField
                    min={0}
                    max={durationSec}
                    step={0.1}
                    value={end / 1000}
                    onChange={(v) => onChange({ endMs: Math.max(Math.min(durationSec * 1000, v * 1000), start) })}
                  />
                </label>
                {hasCustomRange && (
                  <button className="btn-text" onClick={() => onChange({ startMs: undefined, endMs: undefined })}>
                    全体表示に戻す
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
