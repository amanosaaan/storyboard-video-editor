import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecorderStatus } from './useMediaStreamRecorder';

export interface CameraScreenRecorder {
  status: RecorderStatus;
  stream: MediaStream | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

function pickVideoMimeType(): string | undefined {
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

async function playHidden(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return video;
}

/**
 * 画面共有をフル画面、カメラをPiP（右下）として1本のcanvasに合成し、
 * 音声も両方のストリームからミックスして録画する。
 */
export function useCameraScreenRecorder(onStop: (blob: Blob) => void): CameraScreenRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const tracksToStopRef = useRef<MediaStreamTrack[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    for (const track of tracksToStopRef.current) track.stop();
    tracksToStopRef.current = [];
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setPreviewStream(null);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tracksToStopRef.current = [...screenStream.getTracks(), ...cameraStream.getTracks()];

      const screenVideo = await playHidden(screenStream);
      const cameraVideo = await playHidden(cameraStream);

      const canvas = document.createElement('canvas');
      const screenSettings = screenStream.getVideoTracks()[0]?.getSettings();
      canvas.width = screenSettings?.width || screenVideo.videoWidth || 1280;
      canvas.height = screenSettings?.height || screenVideo.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context を取得できませんでした');

      const pipWidth = Math.round(canvas.width * 0.22);
      const cameraAspect = cameraVideo.videoWidth && cameraVideo.videoHeight ? cameraVideo.videoHeight / cameraVideo.videoWidth : 0.75;
      const pipHeight = Math.round(pipWidth * cameraAspect);
      const margin = Math.round(canvas.width * 0.02);

      function draw() {
        ctx!.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        ctx!.drawImage(cameraVideo, canvas.width - pipWidth - margin, canvas.height - pipHeight - margin, pipWidth, pipHeight);
        rafRef.current = requestAnimationFrame(draw);
      }
      draw();

      const canvasStream = canvas.captureStream(30);

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      for (const source of [screenStream, cameraStream]) {
        if (source.getAudioTracks().length === 0) continue;
        const node = audioCtx.createMediaStreamSource(new MediaStream(source.getAudioTracks()));
        node.connect(dest);
      }

      const combined = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      setPreviewStream(combined);

      chunksRef.current = [];
      const mimeType = pickVideoMimeType();
      const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? 'video/webm' });
        cleanup();
        setStatus('stopped');
        onStop(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');

      screenStream.getVideoTracks()[0]?.addEventListener('ended', stop);
    } catch (err) {
      setError(err instanceof Error ? err.message : '録画を開始できませんでした');
      setStatus('error');
      cleanup();
    }
  }, [cleanup, onStop, stop]);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      cleanup();
    },
    [cleanup],
  );

  return { status, stream: previewStream, error, start, stop };
}
