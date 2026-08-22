import { useEffect, useRef, useState } from 'react';
import {
  createCaptionLayer,
  createImageLayerForScene,
  createShapeLayer,
  createTextLayer,
  cropPatch,
} from '../domain/layerFactory';
import { getSceneStartMs } from '../domain/timeline';
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

// .mobile-editor__scenes-scroll の gap（index.css）と一致させること。
const SCENE_CHIP_GAP = 8;
// シーンチップの横幅は動画の長さに正確に比例させる（1秒あたりのpx数）。
const SCENE_CHIP_PX_PER_MS = 0.02; // 20px/秒
// あまりに短いシーンだとタップできない/見えなくなるため最低幅を設ける。
const SCENE_CHIP_MIN_WIDTH = 32;

/** シーンの長さに比例したチップの表示幅(px)を返す（最低幅あり） */
function sceneChipWidth(durationMs: number): number {
  return Math.max(SCENE_CHIP_MIN_WIDTH, durationMs * SCENE_CHIP_PX_PER_MS);
}

/** 現在の再生位置が、チップ列の先頭から何px進んだ位置に当たるかを正確に計算する */
function computeTimelineOffsetPx(scenes: Scene[], sceneIndex: number, localTimeMs: number, sceneDurationMs: number): number {
  const precedingWidth = scenes.slice(0, sceneIndex).reduce((sum, s) => sum + sceneChipWidth(s.duration) + SCENE_CHIP_GAP, 0);
  const progress = sceneDurationMs > 0 ? Math.min(1, Math.max(0, localTimeMs / sceneDurationMs)) : 0;
  return precedingWidth + progress * sceneChipWidth(sceneDurationMs);
}

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

  // CapCutと同様、再生位置を示す線は常に画面中央に固定し、シーンチップ側を
  // 横スクロールさせて追従させる。
  useEffect(() => {
    const container = scenesScrollRef.current;
    const position = engine.position;
    if (!container || !position || !project) return;
    const offset = computeTimelineOffsetPx(project.scenes, position.sceneIndex, position.localTimeMs, position.scene.duration);
    container.scrollLeft = offset - container.clientWidth / 2;
  }, [engine.position, project]);

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
        <input
          className="mobile-editor__seekbar"
          type="range"
          min={0}
          max={engine.totalDurationMs}
          value={engine.currentTimeMs}
          onChange={(e) => engine.seek(Number(e.target.value))}
        />
        <div className="mobile-editor__scenes">
          <div className="mobile-editor__scenes-viewport">
            <div className="mobile-editor__scenes-scroll" ref={scenesScrollRef}>
              {project.scenes.map((scene, i) => (
                <button
                  key={scene.id}
                  className={`mobile-scene-chip${scene.id === currentSceneId ? ' is-active' : ''}${sceneThumbUrls[scene.id] ? ' has-thumb' : ''}`}
                  style={{
                    width: sceneChipWidth(scene.duration),
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
