import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../domain/types';
import { addMediaBlob } from '../storage/mediaRepository';
import { useCameraRecorder } from '../recording/useCameraRecorder';
import { useCameraScreenRecorder } from '../recording/useCameraScreenRecorder';
import { useScreenRecorder } from '../recording/useScreenRecorder';
import { useVoiceoverRecorder } from '../recording/useVoiceoverRecorder';
import { useProjectStore } from '../state/projectStore';
import { Teleprompter } from './Teleprompter';

type RecordingMode = 'camera' | 'screen' | 'cameraScreen' | 'voiceover';

const MODE_LABELS: Record<RecordingMode, string> = {
  camera: 'カメラ',
  screen: '画面',
  cameraScreen: 'カメラ+画面',
  voiceover: 'ボイスオーバー',
};

interface Props {
  project: Project;
  onClose: () => void;
}

export function RecordingPanel({ project, onClose }: Props) {
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const [mode, setMode] = useState<RecordingMode>('camera');
  const [script, setScript] = useState('');
  const [speed, setSpeed] = useState(40);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleStop = useCallback(
    (blob: Blob) => {
      setSaving(true);
      setSavedName(null);
      (async () => {
        try {
          const name = `録画_${new Date().toLocaleString('ja-JP')}.webm`;
          const asset = await addMediaBlob(project.id, blob, name);
          addMediaAsset(asset);
          setSavedName(asset.name);
        } catch (err) {
          console.error(err);
        } finally {
          setSaving(false);
        }
      })();
    },
    [project.id, addMediaAsset],
  );

  const cameraRecorder = useCameraRecorder(handleStop);
  const screenRecorder = useScreenRecorder(handleStop);
  const cameraScreenRecorder = useCameraScreenRecorder(handleStop);
  const voiceoverRecorder = useVoiceoverRecorder(handleStop);

  const active = {
    camera: cameraRecorder,
    screen: screenRecorder,
    cameraScreen: cameraScreenRecorder,
    voiceover: voiceoverRecorder,
  }[mode];

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = active.stream;
  }, [active.stream]);

  const isRecording = active.status === 'starting' || active.status === 'recording';

  return (
    <div className="recording-panel__backdrop" onClick={onClose}>
      <div className="recording-panel" onClick={(e) => e.stopPropagation()}>
        <div className="recording-panel__header">
          <h2>録画</h2>
          <button onClick={onClose}>閉じる</button>
        </div>

        <div className="recording-panel__modes">
          {(Object.keys(MODE_LABELS) as RecordingMode[]).map((m) => (
            <button
              key={m}
              disabled={isRecording}
              className={m === mode ? 'is-active' : ''}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode !== 'voiceover' && <video ref={videoRef} autoPlay muted className="recording-panel__preview" />}

        <Teleprompter
          script={script}
          onScriptChange={setScript}
          isScrolling={isRecording}
          speedPxPerSec={speed}
          onSpeedChange={setSpeed}
        />

        {active.error && <p className="recording-panel__error">{active.error}</p>}

        <div className="recording-panel__controls">
          {!isRecording ? (
            <button onClick={() => void active.start()}>録画開始</button>
          ) : (
            <button onClick={active.stop}>録画停止</button>
          )}
        </div>

        {saving && <p className="inspector__hint">保存中…</p>}
        {savedName && (
          <p className="inspector__hint">「{savedName}」として保存しました。メディア一覧から配置できます。</p>
        )}
      </div>
    </div>
  );
}
