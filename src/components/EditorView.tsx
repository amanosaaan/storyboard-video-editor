import { useEffect, useRef, useState } from 'react';
import { createCaptionLayer, createTextLayer } from '../domain/layerFactory';
import { getSceneStartMs } from '../domain/timeline';
import { exportProjectToMp4, type ExportQuality } from '../export/exportPipeline';
import { useProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { exportProjectFile } from '../storage/projectPortability';
import { useProjectStore } from '../state/projectStore';
import { ArrangeMenu } from './ArrangeMenu';
import { ContextToolbar } from './ContextToolbar';
import { EditorToolbar } from './EditorToolbar';
import { BackIcon, CaptionIcon, FolderOpenIcon, TextIcon } from './icons';
import { Inspector } from './Inspector';
import { MediaLibraryPanel } from './MediaLibraryPanel';
import { MenubarMenu } from './MenubarMenu';
import { PreviewPanel } from './PreviewPanel';
import { RecordingPanel } from './RecordingPanel';
import { StoryboardPanel } from './StoryboardPanel';

export function EditorView() {
  const project = useProjectStore((s) => s.project);
  const closeProject = useProjectStore((s) => s.closeProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const selectedLayerIds = useProjectStore((s) => s.selectedLayerIds);
  const addLayerToScene = useProjectStore((s) => s.addLayerToScene);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [isRecordingOpen, setRecordingOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useProjectPlaybackEngine(canvasRef, project);
  const currentSceneId = engine.position?.scene.id ?? null;

  useEffect(() => {
    selectLayer(null);
  }, [currentSceneId, selectLayer]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      e.preventDefault();
      if (engine.isPlaying) engine.pause();
      else engine.play();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  if (!project) return null;
  const currentScene = engine.position?.scene ?? project.scenes[0];
  const selectedLayers = currentScene.layers.filter((l) => selectedLayerIds.includes(l.id));

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

  async function handleExportProjectFile() {
    if (!project) return;
    try {
      const blob = await exportProjectFile(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'project'}.veproj`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert('プロジェクトの書き出しに失敗しました。');
    }
  }

  return (
    <div className="editor">
      <header className="editor__toolbar">
        <button className="btn-icon" onClick={closeProject} aria-label="一覧へ戻る">
          <BackIcon />
        </button>
        <div className="editor__logo" />
        <input className="editor__project-name" value={project.name} onChange={(e) => renameProject(e.target.value)} />
        <button className="btn-pill" onClick={() => void handleExportProjectFile()}>
          プロジェクトを書き出す
        </button>
        <select
          className="editor__quality-select"
          value={exportQuality}
          onChange={(e) => setExportQuality(e.target.value as ExportQuality)}
          disabled={exporting}
        >
          <option value="low">画質: 低</option>
          <option value="medium">画質: 中</option>
          <option value="high">画質: 高</option>
          <option value="veryHigh">画質: 最高</option>
        </select>
        <button className="btn-pill btn-pill--primary" onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? `書き出し中… ${Math.round(exportProgress * 100)}%` : 'MP4で書き出し'}
        </button>
      </header>
      <nav className="editor__menubar">
        <MenubarMenu label="ファイル" items={[{ label: '開く', icon: FolderOpenIcon, onClick: () => setMediaOpen(true) }]} />
        <span className="editor__menubar-item" aria-hidden="true">
          編集
        </span>
        <span className="editor__menubar-item" aria-hidden="true">
          表示
        </span>
        <MenubarMenu
          label="挿入"
          items={[
            { label: 'テキスト', icon: TextIcon, onClick: () => addLayerToScene(currentScene.id, createTextLayer(currentScene)) },
            {
              label: '字幕',
              icon: CaptionIcon,
              onClick: () => addLayerToScene(currentScene.id, createCaptionLayer(project, currentScene)),
            },
          ]}
        />
        <span className="editor__menubar-item" aria-hidden="true">
          表示形式
        </span>
        <span className="editor__menubar-item" aria-hidden="true">
          シーン
        </span>
        <ArrangeMenu project={project} scene={currentScene} layers={selectedLayers} />
        <span className="editor__menubar-item" aria-hidden="true">
          ツール
        </span>
        <span className="editor__menubar-item" aria-hidden="true">
          ヘルプ
        </span>
      </nav>
      <EditorToolbar />
      <ContextToolbar project={project} scene={currentScene} layers={selectedLayers} />
      <div className="editor__body">
        <div className="editor__center">
          <div className="editor__preview-area">
            <PreviewPanel project={project} canvasRef={canvasRef} engine={engine} />
          </div>
          <StoryboardPanel
            project={project}
            currentSceneId={currentSceneId}
            onSelectScene={(sceneId) => engine.seek(getSceneStartMs(project, sceneId))}
            engine={engine}
          />
        </div>
        <Inspector
          scene={currentScene}
          onOpenMedia={() => setMediaOpen(true)}
          onOpenRecording={() => setRecordingOpen(true)}
          onAddCaption={() => addLayerToScene(currentScene.id, createCaptionLayer(project, currentScene))}
        />
      </div>
      {isMediaOpen && <MediaLibraryPanel project={project} targetSceneId={currentScene.id} onClose={() => setMediaOpen(false)} />}
      {isRecordingOpen && <RecordingPanel project={project} onClose={() => setRecordingOpen(false)} />}
    </div>
  );
}
