import { useEffect, useRef, useState } from 'react';
import {
  createCaptionLayer,
  createImageLayerForScene,
  createShapeLayer,
  createTextLayer,
  cropPatch,
} from '../domain/layerFactory';
import {
  getSceneStartMs,
  resolvePosition,
  sceneChipWidthPx,
  timelineOffsetPxToGlobalMs,
  timelinePositionToOffsetPx,
} from '../domain/timeline';
import type { ImageLayer, Scene } from '../domain/types';
import { exportProjectToMp4, type ExportQuality } from '../export/exportPipeline';
import { useProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { addMediaFile, getThumbnailUrl } from '../storage/mediaRepository';
import { useProjectStore } from '../state/projectStore';
import { BottomSheet } from './BottomSheet';
import { ContextToolbar } from './ContextToolbar';
import { ImageCropModal } from './ImageCropModal';
import {
  AlignCenterHIcon,
  CaptionIcon,
  CloseIcon,
  CopyIcon,
  ExpandIcon,
  ImageIcon,
  MultiSelectIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RecordIcon,
  RedoIcon,
  ScissorsIcon,
  ShapeIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from './icons';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { PreviewPanel } from './PreviewPanel';
import { RecordingPanel } from './RecordingPanel';

/** シーンのプレビューに使う「主役」の動画/画像レイヤーのmediaIdを返す（無ければnull） */
function getSceneMainMediaId(scene: Scene): string | null {
  const visual = scene.layers
    .filter((l) => l.type === 'video' || l.type === 'image')
    .sort((a, b) => a.zIndex - b.zIndex)[0];
  return visual && 'mediaId' in visual ? visual.mediaId : null;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MobileEditorView() {
  const project = useProjectStore((s) => s.project);
  const closeProject = useProjectStore((s) => s.closeProject);
  const selectedLayerIds = useProjectStore((s) => s.selectedLayerIds);
  const addLayerToScene = useProjectStore((s) => s.addLayerToScene);
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const updateLayer = useProjectStore((s) => s.updateLayer);
  const addScene = useProjectStore((s) => s.addScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const removeScene = useProjectStore((s) => s.removeScene);
  const splitScene = useProjectStore((s) => s.splitScene);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const engine = useProjectPlaybackEngine(canvasRef, project);
  const currentSceneId = engine.position?.scene.id ?? null;

  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isArrangeOpen, setArrangeOpen] = useState(false);
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [isRecordingOpen, setRecordingOpen] = useState(false);
  const [croppingImageLayerId, setCroppingImageLayerId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number>();
  const [sceneThumbUrls, setSceneThumbUrls] = useState<Record<string, string>>({});
  const scenesScrollRef = useRef<HTMLDivElement>(null);
  // ユーザーが指でチップ列に触れている（またはその余韻の慣性スクロール中）かどうか。
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
  function handleScenesPointerDown() {
    isUserScrollingRef.current = true;
    if (resumeAutoScrollTimeoutRef.current !== null) {
      window.clearTimeout(resumeAutoScrollTimeoutRef.current);
      resumeAutoScrollTimeoutRef.current = null;
    }
  }
  function handleScenesPointerUp() {
    // タップだけで指を離した場合などスクロールイベントがこの後来ないケースに備え、
    // ここでも一旦タイマーを仕掛けておく。実際に慣性スクロールが続いていれば
    // handleScenesScroll側で随時延長されるので問題ない。
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
  const [scenesViewportHalfWidth, setScenesViewportHalfWidth] = useState(0);
  useEffect(() => {
    function updateHalfWidth() {
      const el = scenesScrollRef.current;
      if (el) setScenesViewportHalfWidth(el.clientWidth / 2);
    }
    updateHalfWidth();
    window.addEventListener('resize', updateHalfWidth);
    return () => window.removeEventListener('resize', updateHalfWidth);
  }, []);

  // CapCutと同様、キャンバスで要素を選択（または別の要素に選択し直）したら自動で
  // プロパティ編集シートを開き、選択解除したら自動で閉じる。
  // 「何か選択された状態」から「別の何かが選択された状態」への変化も検知しないと、
  // 一度シートを手動で閉じた後に別のツール（図形・字幕など）で新しい要素を
  // 追加したときにシートが開かないままになってしまう。
  const prevSelectionKeyRef = useRef('');
  useEffect(() => {
    const key = selectedLayerIds.join(',');
    if (key !== prevSelectionKeyRef.current) {
      setArrangeOpen(key !== '');
      if (key === '') setMultiSelectMode(false);
    }
    prevSelectionKeyRef.current = key;
  }, [selectedLayerIds]);

  // 配置シートが動画プレビューにかからないよう、プレビュー枠の下端から
  // 画面下端までの残り高さを最大高さとして使う。シートを開く前から値を
  // 用意しておくことで、開いた瞬間にCSSの既定値からガクッと変わるのを防ぐ。
  useEffect(() => {
    function updateSheetMaxHeight() {
      const el = previewRef.current;
      if (!el) return;
      const bottom = el.getBoundingClientRect().bottom;
      setSheetMaxHeight(Math.max(160, window.innerHeight - bottom - 8));
    }
    updateSheetMaxHeight();
    window.addEventListener('resize', updateSheetMaxHeight);
    return () => window.removeEventListener('resize', updateSheetMaxHeight);
  }, []);

  // CapCutのように、シーンチップに「主役」の動画/画像素材のサムネイルを表示する。
  useEffect(() => {
    if (!project) return;
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

  // CapCutと同様、再生位置を示す線は常に画面中央に固定し、シーンチップ側を横スクロール
  // させて追従させる。engine.position（約66ms間隔でしか更新されないReact state）ではなく
  // engine.getLiveTimeMs()を毎フレーム読むrAFループで追従させることで、再生中の
  // スクロールを滑らかにする（stateの間引きに引っ張られてカクつくのを防ぐ）。
  // チップ列にはビューポート半分ぶんの余白(scenesViewportHalfWidth)を前後に
  // 付けているため、scrollLeftはそのままoffsetと一致する
  // （offset - clientWidth/2 + 余白(clientWidth/2) = offset）。
  useEffect(() => {
    if (!project) return;
    let raf = 0;
    function tick() {
      const container = scenesScrollRef.current;
      // ユーザーがドラッグ中/慣性スクロール中は指の動きを優先し、自動追従は行わない。
      if (container && project && !isUserScrollingRef.current) {
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
  function handleScenesScroll() {
    const container = scenesScrollRef.current;
    if (!container || !project || !isUserScrollingRef.current) return;
    scheduleResumeAutoScroll(); // まだスクロール（慣性含む）が続いているのでタイマーを延長
    // 前後の余白ぶんscrollLeftとoffsetが一致するので、そのままpx→時刻変換にかける。
    engine.seek(timelineOffsetPxToGlobalMs(project.scenes, container.scrollLeft));
  }

  if (!project) return null;
  const currentScene = engine.position?.scene ?? project.scenes[0];
  const selectedLayers = currentScene.layers.filter((l) => selectedLayerIds.includes(l.id));
  const croppingLayer = currentScene.layers.find(
    (l): l is ImageLayer => l.id === croppingImageLayerId && l.type === 'image',
  );

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportProjectToMp4(project, { onProgress: setExportProgress, quality: exportQuality });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'video'}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert('書き出しに失敗しました。ブラウザがMP4書き出しに対応していない可能性があります。');
    } finally {
      setExporting(false);
    }
  }

  async function handleQuickInsertImages(files: FileList | null) {
    if (!files || !project) return;
    for (const file of Array.from(files)) {
      try {
        const asset = await addMediaFile(project.id, file);
        addMediaAsset(asset);
        addLayerToScene(currentScene.id, createImageLayerForScene(project, currentScene, asset));
      } catch (err) {
        console.error(err);
      }
    }
  }

  function handleAddScene() {
    const newId = addScene();
    if (newId && project) engine.seek(getSceneStartMs(project, newId));
  }

  function handleDuplicateScene() {
    if (!currentSceneId) return;
    const newId = duplicateScene(currentSceneId);
    if (newId && project) engine.seek(getSceneStartMs(project, newId));
  }

  function handleRemoveScene() {
    if (currentSceneId) removeScene(currentSceneId);
  }

  function handleSplitScene() {
    const position = engine.position;
    if (!position) return;
    // グローバル時刻自体は変わらないため、分割後は自動的に新しい後半シーンの先頭に位置する
    // （resolvePositionが境界ちょうどの時刻を次シーンの先頭として扱うため、seek不要）。
    splitScene(position.scene.id, position.localTimeMs);
  }

  const canSplit = !!engine.position && engine.position.localTimeMs > 0 && engine.position.localTimeMs < engine.position.scene.duration;

  return (
    <div className="mobile-editor">
      <header className="mobile-editor__top">
        <button className="mobile-icon-btn" onClick={closeProject} aria-label="閉じる">
          <CloseIcon size={20} />
        </button>
        <div className="mobile-editor__top-right">
          <select
            className="mobile-editor__quality-select"
            value={exportQuality}
            onChange={(e) => setExportQuality(e.target.value as ExportQuality)}
            disabled={exporting}
          >
            <option value="low">画質: 低</option>
            <option value="medium">画質: 中</option>
            <option value="high">画質: 高</option>
            <option value="veryHigh">画質: 最高</option>
          </select>
          <button className="mobile-editor__export" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? `${Math.round(exportProgress * 100)}%` : 'エクスポート'}
          </button>
        </div>
      </header>

      <div className="mobile-editor__preview" ref={previewRef}>
        <PreviewPanel
          project={project}
          canvasRef={canvasRef}
          engine={engine}
          onOpenCrop={(layerId) => setCroppingImageLayerId(layerId)}
          multiSelectMode={multiSelectMode}
        />
      </div>

      <div className="mobile-editor__playback">
        <div className="mobile-editor__playback-left">
          <button className="mobile-icon-btn" disabled title="全画面表示（未対応）">
            <ExpandIcon size={18} />
          </button>
        </div>
        <div className="mobile-editor__playback-center">
          <button className="mobile-icon-btn" onClick={engine.isPlaying ? engine.pause : engine.play} aria-label="再生">
            {engine.isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
        </div>
        <div className="mobile-editor__playback-right">
          <button className="mobile-icon-btn" onClick={undo} disabled={!canUndo} title="元に戻す">
            <UndoIcon size={18} />
          </button>
          <button className="mobile-icon-btn" onClick={redo} disabled={!canRedo} title="やり直す">
            <RedoIcon size={18} />
          </button>
        </div>
      </div>

      <div className="mobile-editor__timeline">
        <div className="mobile-editor__time-row">
          <div className="mobile-editor__time">
            {formatTime(engine.currentTimeMs)} / {formatTime(engine.totalDurationMs)}
          </div>
          <button
            className="mobile-icon-btn"
            onClick={handleSplitScene}
            disabled={!canSplit}
            title="再生位置でシーンを分割"
            aria-label="再生位置でシーンを分割"
          >
            <ScissorsIcon size={16} />
          </button>
        </div>
        <div className="mobile-editor__scenes">
          <div className="mobile-editor__scenes-viewport">
            <div
              className="mobile-editor__scenes-scroll"
              ref={scenesScrollRef}
              onScroll={handleScenesScroll}
              onPointerDown={handleScenesPointerDown}
              onPointerUp={handleScenesPointerUp}
              onPointerCancel={handleScenesPointerUp}
              style={{ paddingLeft: scenesViewportHalfWidth, paddingRight: scenesViewportHalfWidth }}
            >
              {project.scenes.map((scene, i) => (
                <button
                  key={scene.id}
                  className={`mobile-scene-chip${scene.id === currentSceneId ? ' is-active' : ''}${sceneThumbUrls[scene.id] ? ' has-thumb' : ''}`}
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
            {engine.position && <div className="mobile-editor__playhead" />}
          </div>
          <div className="mobile-editor__scenes-actions">
            <button
              className="mobile-icon-btn"
              onClick={handleDuplicateScene}
              disabled={!currentSceneId}
              title="このシーンを複製"
              aria-label="このシーンを複製"
            >
              <CopyIcon size={18} />
            </button>
            <button
              className="mobile-icon-btn"
              onClick={handleRemoveScene}
              disabled={!currentSceneId}
              title="このシーンを削除"
              aria-label="このシーンを削除"
            >
              <TrashIcon size={18} />
            </button>
            <button className="mobile-scene-add" onClick={handleAddScene} aria-label="シーン追加">
              <PlusIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <nav className="mobile-editor__tabs">
        <button className={`mobile-tab${isMediaOpen ? ' is-active' : ''}`} onClick={() => setMediaOpen(true)}>
          <UploadIcon size={20} />
          アップロード
        </button>
        <button className="mobile-tab" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon size={20} />
          画像
        </button>
        <button className={`mobile-tab${isRecordingOpen ? ' is-active' : ''}`} onClick={() => setRecordingOpen(true)}>
          <RecordIcon size={20} />
          録画
        </button>
        <button className="mobile-tab" onClick={() => addLayerToScene(currentScene.id, createShapeLayer(currentScene))}>
          <ShapeIcon size={20} />
          図形
        </button>
        <button className="mobile-tab" onClick={() => addLayerToScene(currentScene.id, createTextLayer(currentScene))}>
          <TextIcon size={20} />
          テキスト
        </button>
        <button
          className="mobile-tab"
          onClick={() => addLayerToScene(currentScene.id, createCaptionLayer(project, currentScene))}
        >
          <CaptionIcon size={20} />
          字幕
        </button>
        <button className={`mobile-tab${isArrangeOpen ? ' is-active' : ''}`} onClick={() => setArrangeOpen(true)}>
          <AlignCenterHIcon size={20} />
          配置
        </button>
      </nav>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleQuickInsertImages(e.target.files);
          e.target.value = '';
        }}
      />

      {isMediaOpen && <MediaLibraryPanel project={project} scene={currentScene} onClose={() => setMediaOpen(false)} />}
      {isRecordingOpen && <RecordingPanel project={project} onClose={() => setRecordingOpen(false)} />}

      {isArrangeOpen && (
        <BottomSheet
          title="配置"
          onClose={() => setArrangeOpen(false)}
          maxHeightPx={sheetMaxHeight}
          headerExtra={
            selectedLayers.length > 0 ? (
              <button
                className={`mobile-icon-btn${multiSelectMode ? ' is-active' : ''}`}
                title="複数選択"
                aria-pressed={multiSelectMode}
                onClick={() => setMultiSelectMode((v) => !v)}
              >
                <MultiSelectIcon size={18} />
              </button>
            ) : undefined
          }
        >
          {selectedLayers.length === 0 ? (
            <p className="mobile-sheet__hint">キャンバスで要素を選択してください</p>
          ) : (
            <ContextToolbar
              project={project}
              scene={currentScene}
              layers={selectedLayers}
              onOpenCrop={(layerId) => setCroppingImageLayerId(layerId)}
            />
          )}
        </BottomSheet>
      )}

      {croppingLayer && (
        <ImageCropModal
          layer={croppingLayer}
          onConfirm={(crop) => {
            const asset = project.mediaLibrary.find((m) => m.id === croppingLayer.mediaId);
            updateLayer(currentScene.id, croppingLayer.id, cropPatch(croppingLayer, crop, asset));
            setCroppingImageLayerId(null);
          }}
          onCancel={() => setCroppingImageLayerId(null)}
        />
      )}
    </div>
  );
}
