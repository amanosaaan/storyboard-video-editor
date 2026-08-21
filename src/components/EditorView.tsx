import { useEffect, useRef, useState } from 'react';
import { getSceneStartMs } from '../domain/timeline';
import { exportProjectToMp4, type ExportQuality } from '../export/exportPipeline';
import { useProjectPlaybackEngine } from '../rendering/useProjectPlaybackEngine';
import { exportProjectFile } from '../storage/projectPortability';
import { useProjectStore } from '../state/projectStore';
import { BackIcon } from './icons';
import { Inspector } from './Inspector';
import { PreviewPanel } from './PreviewPanel';
import { StoryboardPanel } from './StoryboardPanel';

export function EditorView() {
  const project = useProjectStore((s) => s.project);
  const closeProject = useProjectStore((s) => s.closeProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const selectLayer = useProjectStore((s) => s.selectLayer);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useProjectPlaybackEngine(canvasRef, project);
  const currentSceneId = engine.position?.scene.id ?? null;

  useEffect(() => {
    selectLayer(null);
  }, [currentSceneId, selectLayer]);

  if (!project) return null;
  const currentScene = engine.position?.scene ?? project.scenes[0];

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
      <nav className="editor__menubar" aria-hidden="true">
        {['ファイル', '編集', '表示', '挿入', '表示形式', 'シーン', '配置', 'ツール', 'ヘルプ'].map((label) => (
          <span key={label} className="editor__menubar-item">
            {label}
          </span>
        ))}
      </nav>
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
        <Inspector project={project} scene={currentScene} />
      </div>
    </div>
  );
}
