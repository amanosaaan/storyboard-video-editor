import type { AnimationConfig, Layer, Scene, TransitionConfig } from '../domain/types';

export type ResolvedAssetMap = Map<string, HTMLVideoElement | HTMLImageElement>;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawSceneFrame(
  ctx: Ctx2D,
  scene: Scene,
  canvasWidth: number,
  canvasHeight: number,
  resolvedAssets: ResolvedAssetMap,
  sceneTimeMs = 0,
): void {
  ctx.save();
  ctx.fillStyle = scene.backgroundColor ?? '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const sortedLayers = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of sortedLayers) {
    drawLayer(ctx, layer, resolvedAssets, sceneTimeMs);
  }
  ctx.restore();
}

/**
 * 2つのシーンをまたぐトランジションのフレームを描画する。
 * fromScene → toScene の切り替え中、progress は 0（fromのみ）→ 1（toのみ）で進む。
 * 次シーンの動画/音声はまだ再生開始しない前提（呼び出し側で先頭フレームを渡す）。
 */
export function drawTransitionFrame(
  ctx: Ctx2D,
  fromScene: Scene,
  toScene: Scene,
  progress: number,
  transition: TransitionConfig,
  canvasWidth: number,
  canvasHeight: number,
  resolvedAssets: ResolvedAssetMap,
  fromSceneTimeMs: number,
): void {
  const p = Math.min(1, Math.max(0, progress));

  switch (transition.type) {
    case 'crossfade': {
      drawSceneFrame(ctx, fromScene, canvasWidth, canvasHeight, resolvedAssets, fromSceneTimeMs);
      ctx.save();
      ctx.globalAlpha = p;
      drawSceneFrame(ctx, toScene, canvasWidth, canvasHeight, resolvedAssets, 0);
      ctx.restore();
      break;
    }
    case 'slide': {
      ctx.save();
      ctx.translate(-p * canvasWidth, 0);
      drawSceneFrame(ctx, fromScene, canvasWidth, canvasHeight, resolvedAssets, fromSceneTimeMs);
      ctx.restore();
      ctx.save();
      ctx.translate(canvasWidth - p * canvasWidth, 0);
      drawSceneFrame(ctx, toScene, canvasWidth, canvasHeight, resolvedAssets, 0);
      ctx.restore();
      break;
    }
    case 'wipe': {
      drawSceneFrame(ctx, fromScene, canvasWidth, canvasHeight, resolvedAssets, fromSceneTimeMs);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, p * canvasWidth, canvasHeight);
      ctx.clip();
      drawSceneFrame(ctx, toScene, canvasWidth, canvasHeight, resolvedAssets, 0);
      ctx.restore();
      break;
    }
  }
}

function applyAnimationTransform(
  ctx: Ctx2D,
  animation: AnimationConfig | undefined,
  sceneTimeMs: number,
  width: number,
  height: number,
): void {
  if (!animation || animation.durationMs <= 0) return;
  const t = (sceneTimeMs % animation.durationMs) / animation.durationMs;
  const angle = 2 * Math.PI * t;
  switch (animation.type) {
    case 'pulse': {
      const s = 1 + 0.08 * Math.sin(angle);
      ctx.scale(s, s);
      break;
    }
    case 'spin':
      ctx.rotate(angle);
      break;
    case 'hover':
      ctx.translate(0, Math.sin(angle) * height * 0.06);
      break;
    case 'shake':
      ctx.translate(Math.sin(angle * 6) * width * 0.02, 0);
      break;
    case 'bounce':
      ctx.translate(0, -Math.abs(Math.sin(Math.PI * t)) * height * 0.15);
      break;
  }
}

function drawLayer(ctx: Ctx2D, layer: Layer, assets: ResolvedAssetMap, sceneTimeMs: number): void {
  ctx.save();
  // 上書きではなく乗算にする。クロスフェード等のトランジションは外側の
  // globalAlpha（progress）をセットした状態で drawSceneFrame を呼ぶため、
  // ここで単純に上書きするとレイヤーの内容だけフェードせず即座に出現してしまう。
  ctx.globalAlpha *= layer.opacity;
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  applyAnimationTransform(ctx, layer.animation, sceneTimeMs, layer.width, layer.height);
  ctx.translate(-cx, -cy);

  switch (layer.type) {
    case 'video':
    case 'image': {
      const el = assets.get(layer.mediaId);
      if (el) {
        if (layer.filter) {
          ctx.filter = `brightness(${layer.filter.brightness}%) contrast(${layer.filter.contrast}%)`;
        }
        if (layer.type === 'image' && layer.crop && el instanceof HTMLImageElement) {
          const sx = layer.crop.x * el.naturalWidth;
          const sy = layer.crop.y * el.naturalHeight;
          const sWidth = layer.crop.width * el.naturalWidth;
          const sHeight = layer.crop.height * el.naturalHeight;
          ctx.drawImage(el, sx, sy, sWidth, sHeight, layer.x, layer.y, layer.width, layer.height);
        } else {
          ctx.drawImage(el, layer.x, layer.y, layer.width, layer.height);
        }
        if (layer.filter) ctx.filter = 'none';
      }
      break;
    }
    case 'text': {
      if (layer.backgroundColor) {
        ctx.fillStyle = layer.backgroundColor;
        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      }
      ctx.fillStyle = layer.color;
      ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
      ctx.textAlign = layer.align;
      ctx.textBaseline = 'top';
      if (layer.strokeColor) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth ?? 2;
        ctx.lineJoin = 'round';
      }
      const textX =
        layer.align === 'left'
          ? layer.x
          : layer.align === 'right'
            ? layer.x + layer.width
            : layer.x + layer.width / 2;
      const lineHeight = layer.fontSize * 1.25;
      const lines = layer.content.split('\n');
      lines.forEach((line, i) => {
        const lineY = layer.y + i * lineHeight;
        if (layer.strokeColor) ctx.strokeText(line, textX, lineY, layer.width);
        ctx.fillText(line, textX, lineY, layer.width);
      });
      break;
    }
    case 'shape': {
      ctx.fillStyle = layer.fill;
      if (layer.shape === 'rect') {
        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
        if (layer.stroke) {
          ctx.strokeStyle = layer.stroke;
          ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
        }
      } else if (layer.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
          layer.x + layer.width / 2,
          layer.y + layer.height / 2,
          layer.width / 2,
          layer.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (layer.stroke) {
          ctx.strokeStyle = layer.stroke;
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(layer.x, layer.y);
        ctx.lineTo(layer.x + layer.width, layer.y + layer.height);
        ctx.strokeStyle = layer.stroke ?? layer.fill;
        ctx.stroke();
      }
      break;
    }
    case 'audio':
      break;
  }
  ctx.restore();
}
