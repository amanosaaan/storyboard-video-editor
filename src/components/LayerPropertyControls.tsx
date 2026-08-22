import type { AnimationConfig, PhotoFilter } from '../domain/types';
import { NumberField } from './NumberField';

const ANIMATION_LABELS: Record<AnimationConfig['type'], string> = {
  pulse: 'パルス',
  spin: '回転',
  hover: 'ふわふわ',
  shake: 'シェイク',
  bounce: 'バウンド',
};

export function AnimationControl({
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
