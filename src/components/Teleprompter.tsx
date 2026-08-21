import { useEffect, useRef } from 'react';

interface Props {
  script: string;
  onScriptChange: (text: string) => void;
  isScrolling: boolean;
  speedPxPerSec: number;
  onSpeedChange: (value: number) => void;
}

export function Teleprompter({ script, onScriptChange, isScrolling, speedPxPerSec, onSpeedChange }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isScrolling) return;
    if (viewerRef.current) viewerRef.current.scrollTop = 0;

    function tick(ts: number) {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const deltaSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      if (viewerRef.current) viewerRef.current.scrollTop += speedPxPerSec * deltaSec;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [isScrolling, speedPxPerSec]);

  return (
    <div className="teleprompter">
      {isScrolling ? (
        <div className="teleprompter__viewer" ref={viewerRef}>
          <p className="teleprompter__text">{script || '（台本が入力されていません）'}</p>
        </div>
      ) : (
        <textarea
          className="teleprompter__editor"
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="ここに台本を入力すると、録画中に自動スクロール表示されます"
        />
      )}
      <label className="teleprompter__speed">
        スクロール速度
        <input
          type="range"
          min={10}
          max={200}
          step={5}
          value={speedPxPerSec}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
