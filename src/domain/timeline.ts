import { nanoid } from 'nanoid';
import type { Project, Scene } from './types';

export function getTotalDurationMs(project: Project): number {
  return project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

export function getSceneStartMs(project: Project, sceneId: string): number {
  let acc = 0;
  for (const scene of project.scenes) {
    if (scene.id === sceneId) return acc;
    acc += scene.duration;
  }
  return 0;
}

export interface TimelinePosition {
  scene: Scene;
  sceneIndex: number;
  sceneStartMs: number;
  localTimeMs: number;
}

/**
 * 全体タイムライン上のミリ秒からシーンとシーン内ローカル時刻を求める。
 * ちょうど境界上の時刻は次のシーンの先頭として扱う。
 */
export function resolvePosition(project: Project, globalTimeMs: number): TimelinePosition | null {
  if (project.scenes.length === 0) return null;
  const clamped = Math.max(0, globalTimeMs);
  let acc = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const isLast = i === project.scenes.length - 1;
    if (clamped < acc + scene.duration || isLast) {
      const localTimeMs = Math.min(Math.max(clamped - acc, 0), scene.duration);
      return { scene, sceneIndex: i, sceneStartMs: acc, localTimeMs };
    }
    acc += scene.duration;
  }
  return null;
}

/**
 * シーンをローカル時刻(ms)の位置で前半・後半の2シーンに分割する。
 * 動画・音声レイヤーは後半の再生開始位置を分割点の分だけ進め、続きから
 * 再生されるようにする。テキストや図形など時間軸を持たないレイヤーは
 * そのまま両方に複製する。シーン間の切り替え効果(transitionOut)は、
 * 元々「次のシーンへ」のものなので後半側に引き継ぐ（前半と後半の間はカット）。
 * 分割点がシーンの先頭・末尾ちょうどの場合は分割する意味がないため null を返す。
 */
export function splitSceneAt(
  scenes: Scene[],
  sceneId: string,
  localTimeMs: number,
): { scenes: Scene[]; newSceneId: string } | null {
  const index = scenes.findIndex((s) => s.id === sceneId);
  if (index === -1) return null;
  const original = scenes[index];
  const splitAt = Math.round(localTimeMs);
  if (splitAt <= 0 || splitAt >= original.duration) return null;

  const firstScene: Scene = { ...original, duration: splitAt, transitionOut: undefined };
  const secondScene: Scene = {
    ...original,
    id: nanoid(),
    duration: original.duration - splitAt,
    transitionOut: original.transitionOut,
    layers: original.layers.map((l) =>
      l.type === 'video' || l.type === 'audio' ? { ...l, id: nanoid(), trimStart: l.trimStart + splitAt } : { ...l, id: nanoid() },
    ),
  };

  const newScenes = [...scenes];
  newScenes.splice(index, 1, firstScene, secondScene);
  return { scenes: newScenes, newSceneId: secondScene.id };
}
