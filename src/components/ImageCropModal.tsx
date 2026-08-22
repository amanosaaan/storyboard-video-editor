import { useEffect, useRef, useState } from 'react';
import type { ImageLayer } from '../domain/types';
import { getMediaObjectUrl } from '../storage/mediaRepository';
import { CloseIcon } from './icons';

interface Props {
  layer: ImageLayer;
  onConfirm: (crop: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_DISPLAY = 560;
const MIN_CROP_PX = 24;

type DragMode = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function ImageCropModal({ layer, onConfirm, onCancel }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; startRect: Rect } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMediaObjectUrl(layer.mediaId).then((url) => {
      if (!cancelled && url) setImgUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [layer.mediaId]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const naturalW = e.currentTarget.naturalWidth;
    const naturalH = e.currentTarget.naturalHeight;
    const scale = Math.min(MAX_DISPLAY / naturalW, MAX_DISPLAY / naturalH, 1);
    const width = naturalW * scale;
    const height = naturalH * scale;
    setImgSize({ width, height });
    const crop = layer.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    setRect({ x: crop.x * width, y: crop.y * height, width: crop.width * width, height: crop.height * height });
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !imgSize) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setRect(() => clampRect(applyDrag(drag.mode, drag.startRect, dx, dy), imgSize));
    }
    function handleMouseUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [imgSize]);

  function startDrag(mode: DragMode) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!rect) return;
      dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startRect: rect };
    };
  }

  function handleConfirm() {
    if (!rect || !imgSize) return;
    onConfirm({
      x: rect.x / imgSize.width,
      y: rect.y / imgSize.height,
      width: rect.width / imgSize.width,
      height: rect.height / imgSize.height,
    });
  }

  return (
    <div className="crop-modal__backdrop" onClick={onCancel}>
      <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal__header">
          <h2>トリミング</h2>
          <button className="btn-icon" onClick={onCancel} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        <div className="crop-modal__body">
          {imgUrl && (
            <div className="crop-modal__stage" style={imgSize ? { width: imgSize.width, height: imgSize.height } : undefined}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={imgUrl} onLoad={handleImageLoad} draggable={false} />
              {rect && imgSize && (
                <>
                  <div className="crop-modal__mask" style={{ clipPath: maskClipPath(rect) }} />
                  <div
                    className="crop-modal__rect"
                    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                    onMouseDown={startDrag('move')}
                  >
                    {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as DragMode[]).map((h) => (
                      <div key={h} className={`crop-modal__handle crop-modal__handle--${h}`} onMouseDown={startDrag(h)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="crop-modal__footer">
          <button className="btn-pill" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn-pill btn-pill--primary" onClick={handleConfirm}>
            完了
          </button>
        </div>
      </div>
    </div>
  );
}

function applyDrag(mode: DragMode, start: Rect, dx: number, dy: number): Rect {
  let { x, y, width, height } = start;
  if (mode === 'move') {
    x += dx;
    y += dy;
    return { x, y, width, height };
  }
  if (mode.includes('n')) {
    y += dy;
    height -= dy;
  }
  if (mode.includes('s')) {
    height += dy;
  }
  if (mode.includes('w')) {
    x += dx;
    width -= dx;
  }
  if (mode.includes('e')) {
    width += dx;
  }
  return { x, y, width, height };
}

function clampRect(rect: Rect, bounds: { width: number; height: number }): Rect {
  let { x, y, width, height } = rect;
  width = Math.max(MIN_CROP_PX, width);
  height = Math.max(MIN_CROP_PX, height);
  x = Math.max(0, Math.min(x, bounds.width - width));
  y = Math.max(0, Math.min(y, bounds.height - height));
  width = Math.min(width, bounds.width - x);
  height = Math.min(height, bounds.height - y);
  return { x, y, width, height };
}

function maskClipPath(rect: Rect): string {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  return `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${y1}px, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, 0 ${y1}px)`;
}
