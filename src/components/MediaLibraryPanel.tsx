import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { AudioLayer, ImageLayer, MediaAsset, Project, VideoLayer } from '../domain/types';
import { addMediaFile, getThumbnailUrl } from '../storage/mediaRepository';
import { useProjectStore } from '../state/projectStore';
import { CloseIcon } from './icons';

interface Props {
  project: Project;
  targetSceneId: string;
  onClose: () => void;
}

export function MediaLibraryPanel({ project, targetSceneId, onClose }: Props) {
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const addLayerToScene = useProjectStore((s) => s.addLayerToScene);
  const updateSceneDuration = useProjectStore((s) => s.updateSceneDuration);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const asset of project.mediaLibrary) {
        if (!asset.thumbnailBlobId) continue;
        const url = await getThumbnailUrl(asset.thumbnailBlobId);
        if (url && !cancelled) {
          setThumbUrls((prev) => (prev[asset.id] ? prev : { ...prev, [asset.id]: url }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const asset = await addMediaFile(project.id, file);
        addMediaAsset(asset);
      } catch (err) {
        console.error(err);
      }
    }
    setUploading(false);
  }

  function placeOnScene(asset: MediaAsset) {
    const base = {
      id: nanoid(),
      x: 0,
      y: 0,
      width: project.resolution.width,
      height: project.resolution.height,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
    };
    if (asset.kind === 'video') {
      const layer: VideoLayer = { ...base, type: 'video', mediaId: asset.id, trimStart: 0, volume: 1, muted: false };
      addLayerToScene(targetSceneId, layer);
      // Google Vids と同様、取り込んだ動画の長さにシーンの長さを合わせる。
      if (asset.durationMs) updateSceneDuration(targetSceneId, asset.durationMs);
    } else if (asset.kind === 'image') {
      const layer: ImageLayer = { ...base, type: 'image', mediaId: asset.id };
      addLayerToScene(targetSceneId, layer);
    } else {
      const layer: AudioLayer = { ...base, type: 'audio', mediaId: asset.id, trimStart: 0, volume: 1, role: 'music' };
      addLayerToScene(targetSceneId, layer);
    }
  }

  return (
    <div className="media-flyout__backdrop" onClick={onClose}>
      <div className="media-flyout" onClick={(e) => e.stopPropagation()}>
        <div className="media-flyout__header">
          <h2>メディア</h2>
          <button className="btn-icon" onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        <div className="media-flyout__body">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'アップロード中…' : 'ファイルを追加'}
          </button>
          <ul className="media-library__list">
            {project.mediaLibrary.map((asset) => (
              <li key={asset.id} className="media-library__item">
                {thumbUrls[asset.id] ? (
                  <img src={thumbUrls[asset.id]} alt={asset.name} />
                ) : (
                  <div className="media-library__placeholder">{asset.kind}</div>
                )}
                <span className="media-library__name" title={asset.name}>
                  {asset.name}
                </span>
                <button onClick={() => placeOnScene(asset)}>
                  {asset.kind === 'audio' ? 'シーンにBGMとして追加' : 'シーンに配置'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
