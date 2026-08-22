import { useRef, useState } from 'react';
import {
  alignPatches,
  bringToFrontPatches,
  rotatePatches,
  sendToBackPatches,
  type LayerPatch,
} from '../domain/arrange';
import { createCaptionLayer, createImageLayerForScene, createTextLayer } from '../domain/layerFactory';
import { getSceneStartMs } from '../domain/timeline';
import type { ImageLayer, VideoLayer } from '../domain/types';
import { exportProjectToMp4, type ExportQuality } from '../export/exportPipeline';
import { useProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { addMediaFile } from '../storage/mediaRepository';
import { useProjectStore } from '../state/projectStore';
import { BottomSheet } from './BottomSheet';
import { ImageCropModal } from './ImageCropModal';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignLeftIcon,
  AlignMiddleIcon,
  AlignRightIcon,
  AlignTopIcon,
  BringToFrontIcon,
  CaptionIcon,
  CloseIcon,
  ExpandIcon,
  FilterIcon,
  ImageIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RedoIcon,
  RotateLeftIcon,
  RotateRightIcon,
  ScissorsIcon,
  SendToBackIcon,
  SparklesIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from './icons';
import { AnimationControl, PhotoFilterControl } from './LayerPropertyControls';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { PreviewPanel } from './PreviewPanel';

type SheetId = 'edit' | 'effect' | 'filter' | null;

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
  const removeLayer = useProjectStore((s) => s.removeLayer);
  const addScene = useProjectStore((s) => s.addScene);
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
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [croppingImageLayerId, setCroppingImageLayerId] = useState<string | null>(null);

  if (!project) return null;
  const currentScene = engine.position?.scene ?? project.scenes[0];
  const selectedLayers = currentScene.layers.filter((l) => selectedLayerIds.includes(l.id));
  const selectedLayer = selectedLayers[0];
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
        addLayerToScene(currentScene.id, createImageLayerForScene(project, currentScene, asset.id));
      } catch (err) {
        console.error(err);
      }
    }
  }

  function applyArrange(results: LayerPatch[]) {
    results.forEach(({ id, patch }) => updateLayer(currentScene.id, id, patch));
  }

  function handleAddScene() {
    const newId = addScene();
    if (newId && project) engine.seek(getSceneStartMs(project, newId));
  }

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

      <div className="mobile-editor__preview">
        <PreviewPanel
          project={project}
          canvasRef={canvasRef}
          engine={engine}
          onOpenCrop={(layerId) => setCroppingImageLayerId(layerId)}
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
        <div className="mobile-editor__time">
          {formatTime(engine.currentTimeMs)} / {formatTime(engine.totalDurationMs)}
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
          {project.scenes.map((scene, i) => (
            <button
              key={scene.id}
              className={`mobile-scene-chip${scene.id === currentSceneId ? ' is-active' : ''}`}
              onClick={() => engine.seek(getSceneStartMs(project, scene.id))}
            >
              {i + 1}
            </button>
          ))}
          <button className="mobile-scene-add" onClick={handleAddScene} aria-label="シーン追加">
            <PlusIcon size={18} />
          </button>
        </div>
      </div>

      <nav className="mobile-editor__tabs">
        <button
          className={`mobile-tab${activeSheet === 'edit' ? ' is-active' : ''}`}
          onClick={() => setActiveSheet('edit')}
        >
          <ScissorsIcon size={20} />
          編集
        </button>
        <button className={`mobile-tab${isMediaOpen ? ' is-active' : ''}`} onClick={() => setMediaOpen(true)}>
          <MusicIcon size={20} />
          オーディオ
        </button>
        <button className="mobile-tab" onClick={() => addLayerToScene(currentScene.id, createTextLayer(currentScene))}>
          <TextIcon size={20} />
          テキスト
        </button>
        <button
          className={`mobile-tab${activeSheet === 'effect' ? ' is-active' : ''}`}
          onClick={() => setActiveSheet('effect')}
        >
          <SparklesIcon size={20} />
          エフェクト
        </button>
        <button className="mobile-tab" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon size={20} />
          オーバーレイ
        </button>
        <button
          className="mobile-tab"
          onClick={() => addLayerToScene(currentScene.id, createCaptionLayer(project, currentScene))}
        >
          <CaptionIcon size={20} />
          キャプション
        </button>
        <button
          className={`mobile-tab${activeSheet === 'filter' ? ' is-active' : ''}`}
          onClick={() => setActiveSheet('filter')}
        >
          <FilterIcon size={20} />
          フィルタ
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

      {activeSheet === 'edit' && (
        <BottomSheet title="編集" onClose={() => setActiveSheet(null)}>
          {!selectedLayer ? (
            <p className="mobile-sheet__hint">キャンバスで要素を選択してください</p>
          ) : (
            <div className="mobile-arrange-grid">
              <button onClick={() => applyArrange(bringToFrontPatches(currentScene.layers, selectedLayers))}>
                <BringToFrontIcon size={20} />
                最前面へ
              </button>
              <button onClick={() => applyArrange(sendToBackPatches(currentScene.layers, selectedLayers))}>
                <SendToBackIcon size={20} />
                最背面へ
              </button>
              <button onClick={() => applyArrange(rotatePatches(selectedLayers, -90))}>
                <RotateLeftIcon size={20} />
                反時計回り
              </button>
              <button onClick={() => applyArrange(rotatePatches(selectedLayers, 90))}>
                <RotateRightIcon size={20} />
                時計回り
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'left'))}>
                <AlignLeftIcon size={20} />
                左揃え
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'centerH'))}>
                <AlignCenterHIcon size={20} />
                左右中央
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'right'))}>
                <AlignRightIcon size={20} />
                右揃え
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'top'))}>
                <AlignTopIcon size={20} />
                上揃え
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'centerV'))}>
                <AlignMiddleIcon size={20} />
                上下中央
              </button>
              <button onClick={() => applyArrange(alignPatches(project, selectedLayers, 'bottom'))}>
                <AlignBottomIcon size={20} />
                下揃え
              </button>
              <button
                onClick={() => {
                  selectedLayers.forEach((l) => removeLayer(currentScene.id, l.id));
                  setActiveSheet(null);
                }}
              >
                <TrashIcon size={20} />
                削除
              </button>
            </div>
          )}
        </BottomSheet>
      )}

      {isMediaOpen && (
        <MediaLibraryPanel project={project} scene={currentScene} onClose={() => setMediaOpen(false)} />
      )}

      {activeSheet === 'effect' && (
        <BottomSheet title="エフェクト" onClose={() => setActiveSheet(null)}>
          {!selectedLayer ? (
            <p className="mobile-sheet__hint">キャンバスで要素を選択してください</p>
          ) : (
            <AnimationControl
              animation={selectedLayer.animation}
              onChange={(a) => updateLayer(currentScene.id, selectedLayer.id, { animation: a })}
            />
          )}
        </BottomSheet>
      )}

      {activeSheet === 'filter' && (
        <BottomSheet title="フィルタ" onClose={() => setActiveSheet(null)}>
          {!selectedLayer || (selectedLayer.type !== 'image' && selectedLayer.type !== 'video') ? (
            <p className="mobile-sheet__hint">画像または動画を選択してください</p>
          ) : (
            <PhotoFilterControl
              filter={(selectedLayer as ImageLayer | VideoLayer).filter}
              onChange={(f) => updateLayer(currentScene.id, selectedLayer.id, { filter: f })}
            />
          )}
        </BottomSheet>
      )}

      {croppingLayer && (
        <ImageCropModal
          layer={croppingLayer}
          onConfirm={(crop) => {
            updateLayer(currentScene.id, croppingLayer.id, { crop });
            setCroppingImageLayerId(null);
          }}
          onCancel={() => setCroppingImageLayerId(null)}
        />
      )}
    </div>
  );
}
