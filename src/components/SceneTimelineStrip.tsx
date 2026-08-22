import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  getSceneStartMs,
  resolvePosition,
  sceneChipWidthPx,
  timelineOffsetPxToGlobalMs,
  timelinePositionToOffsetPx,
} from '../domain/timeline';
import type { Project, Scene } from '../domain/types';
import type { ProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { getThumbnailUrl } from '../storage/mediaRepository';

interface Props {
  project: Project;
  engine: ProjectPlaybackEngine;
  currentSceneId: string | null;
}

/** シーンのプレビューに使う「主役」の動画/画像レイヤーのmediaIdを返す（無ければnull） */
function getSceneMainMediaId(scene: Scene): string | null {
  const visual = scene.layers
    .filter((l) => l.type === 'video' || l.type === 'image')
    .sort((a, b) => a.zIndex - b.zIndex)[0];
  return visual && 'mediaId' in visual ? visual.mediaId : null;
}

/**
 * CapCut風のシーンタイムライン。再生位置を示す線は常に画面中央に固定し、
 * シーンチップ（各シーンの長さに比例した幅で、素材のサムネイルを背景に表示）の
 * 列を横スクロールさせて追従させる。チップ列自体を直接ドラッグ/スクロール
 * すれば、その位置が再生位置になる（＝チップ列自体がシークバーを兼ねる）。
 * PC・スマホ共通で使う。
 */
export function SceneTimelineStrip({ project, engine, currentSceneId }: Props) {
  const [sceneThumbUrls, setSceneThumbUrls] = useState<Record<string, string>>({});
  const scenesScrollRef = useRef<HTMLDivElement>(null);

  // ユーザーが指/マウスでチップ列に触れている（またはその余韻の慣性スクロール中）かどうか。
  // これがtrueの間だけscrollイベントを「ユーザー操作」として再生位置に反映し、
  // 自動追従（下のrAFループ）はscrollLeftの書き換えを控える。
  //
  // 以前はここを「自動追従で書き換えた値と実際のscrollLeftを比較して一致すれば無視」
  // という方式にしていたが、再生中は毎フレームscrollLeftを書き換えるため、
  // ブラウザがscrollイベントを間引き・非同期で発火させるタイミングとズレると
  // 「狙った値」の記録が次のフレームの値で上書きされてしまい、比較が一致せず
  // ユーザー操作と誤判定してengine.seek()を呼んでしまうことがあった。
  // それが毎フレーム発生すると、実際の再生位置(timeRef.current)を外から
  // 継続的に書き換えてしまい、動画・音声の再生自体が進まなくなる重大な不具合になっていた。
  // ポインター（指/マウス）が実際に触れているかという確実な信号で判定するよう変更し、
  // この種のタイミング競合を根本から無くした。
  const isUserScrollingRef = useRef(false);
  const resumeAutoScrollTimeoutRef = useRef<number | null>(null);
  function scheduleResumeAutoScroll() {
    if (resumeAutoScrollTimeoutRef.current !== null) window.clearTimeout(resumeAutoScrollTimeoutRef.current);
    resumeAutoScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      resumeAutoScrollTimeoutRef.current = null;
    }, 150);
  }
  // マウスはタッチと違い、触れているだけではOSが横スクロールしてくれないため、
  // クリック&ドラッグでscrollLeftを手動に動かす（タッチはブラウザのネイティブな
  // パン操作に任せ、ここでは何もしない＝二重に動いてしまうのを避ける）。
  const mouseDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isUserScrollingRef.current = true;
    if (resumeAutoScrollTimeoutRef.current !== null) {
      window.clearTimeout(resumeAutoScrollTimeoutRef.current);
      resumeAutoScrollTimeoutRef.current = null;
    }
    if (e.pointerType === 'mouse') {
      const container = scenesScrollRef.current;
      if (container) {
        mouseDragRef.current = { startX: e.clientX, startScrollLeft: container.scrollLeft };
        container.setPointerCapture(e.pointerId);
      }
    }
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    const container = scenesScrollRef.current;
    if (!drag || !container) return;
    container.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }
  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const container = scenesScrollRef.current;
    if (mouseDragRef.current && container) {
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        // すでに解放済みなら何もしなくてよい
      }
    }
    mouseDragRef.current = null;
    // タップ/クリックだけで指を離した場合などスクロールイベントがこの後来ないケースに備え、
    // ここでも一旦タイマーを仕掛けておく。実際に慣性スクロールが続いていれば
    // handleScroll側で随時延長されるので問題ない。
    scheduleResumeAutoScroll();
  }
  useEffect(() => {
    return () => {
      if (resumeAutoScrollTimeoutRef.current !== null) window.clearTimeout(resumeAutoScrollTimeoutRef.current);
    };
  }, []);

  // タイムラインの先頭（0秒）や末尾も画面中央まで持って来られるよう、チップ列の
  // 前後にビューポート半分ぶんの余白を持たせる。これが無いと、最初のシーンは
  // どんなにスクロールしてもプレイヘッド（画面中央）まで届かない
  // （scrollLeftは0未満にできないため）。
  const [viewportHalfWidth, setViewportHalfWidth] = useState(0);
  useEffect(() => {
    function updateHalfWidth() {
      const el = scenesScrollRef.current;
      if (el) setViewportHalfWidth(el.clientWidth / 2);
    }
    updateHalfWidth();
    window.addEventListener('resize', updateHalfWidth);
    return () => window.removeEventListener('resize', updateHalfWidth);
  }, []);

  // CapCutのように、シーンチップに「主役」の動画/画像素材のサムネイルを表示する。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const scene of project.scenes) {
        const mediaId = getSceneMainMediaId(scene);
        const asset = mediaId ? project.mediaLibrary.find((m) => m.id === mediaId) : undefined;
        if (!asset?.thumbnailBlobId) continue;
        const url = await getThumbnailUrl(asset.thumbnailBlobId);
        if (url && !cancelled) {
          setSceneThumbUrls((prev) => (prev[scene.id] ? prev : { ...prev, [scene.id]: url }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  // 再生位置を示す線は常に画面中央に固定し、シーンチップ側を横スクロールさせて追従させる。
  // engine.position（約66ms間隔でしか更新されないReact state）ではなく
  // engine.getLiveTimeMs()を毎フレーム読むrAFループで追従させることで、再生中の
  // スクロールを滑らかにする（stateの間引きに引っ張られてカクつくのを防ぐ）。
  // チップ列にはビューポート半分ぶんの余白(viewportHalfWidth)を前後に付けているため、
  // scrollLeftはそのままoffsetと一致する（offset - clientWidth/2 + 余白(clientWidth/2) = offset）。
  useEffect(() => {
    let raf = 0;
    function tick() {
      const container = scenesScrollRef.current;
      // ユーザーがドラッグ中/慣性スクロール中は指・マウスの動きを優先し、自動追従は行わない。
      if (container && !isUserScrollingRef.current) {
        const position = resolvePosition(project, engine.getLiveTimeMs());
        if (position) {
          const target = timelinePositionToOffsetPx(
            project.scenes,
            position.sceneIndex,
            position.localTimeMs,
            position.scene.duration,
          );
          if (Math.abs(container.scrollLeft - target) > 0.5) {
            container.scrollLeft = target;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [project, engine.getLiveTimeMs]);

  // ユーザーがシーンチップ列を直接ドラッグ/スクロールしたら、その位置を再生位置として
  // 扱う（＝チップ列自体がシークバーを兼ねる）。isUserScrollingRefがfalseの間の
  // scrollイベントは自動追従由来なので無視する（詳しい経緯は上のrefのコメント参照）。
  function handleScroll() {
    const container = scenesScrollRef.current;
    if (!container || !isUserScrollingRef.current) return;
    scheduleResumeAutoScroll(); // まだスクロール（慣性含む）が続いているのでタイマーを延長
    // 前後の余白ぶんscrollLeftとoffsetが一致するので、そのままpx→時刻変換にかける。
    engine.seek(timelineOffsetPxToGlobalMs(project.scenes, container.scrollLeft));
  }

  return (
    <div className="scene-timeline">
      <div className="scene-timeline__viewport">
        <div
          className="scene-timeline__scroll"
          ref={scenesScrollRef}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ paddingLeft: viewportHalfWidth, paddingRight: viewportHalfWidth }}
        >
          {project.scenes.map((scene, i) => (
            <button
              key={scene.id}
              className={`scene-timeline__chip${scene.id === currentSceneId ? ' is-active' : ''}${sceneThumbUrls[scene.id] ? ' has-thumb' : ''}`}
              style={{
                width: sceneChipWidthPx(scene.duration),
                ...(sceneThumbUrls[scene.id] ? { backgroundImage: `url(${sceneThumbUrls[scene.id]})` } : undefined),
              }}
              onClick={() => engine.seek(getSceneStartMs(project, scene.id))}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {/* スクロールするコンテナの外(兄弟要素)に置くことで、scrollLeftの影響を受けず
            常に画面中央に固定表示される。追従はJS側でscrollLeftを調整して行う。 */}
        {engine.position && <div className="scene-timeline__playhead" />}
      </div>
    </div>
  );
}
