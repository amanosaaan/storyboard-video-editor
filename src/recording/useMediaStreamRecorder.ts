import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'stopped' | 'error';

export interface MediaStreamRecorder {
  status: RecorderStatus;
  stream: MediaStream | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

function pickMimeType(hasVideo: boolean): string | undefined {
  const candidates = hasVideo
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** getUserMedia/getDisplayMedia で取得したストリームを MediaRecorder で録画する共通フック。 */
export function useMediaStreamRecorder(
  acquireStream: () => Promise<MediaStream>,
  onStop: (blob: Blob) => void,
): MediaStreamRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    try {
      const mediaStream = await acquireStream();
      streamRef.current = mediaStream;
      setStream(mediaStream);
      chunksRef.current = [];
      const mimeType = pickMimeType(mediaStream.getVideoTracks().length > 0);
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? 'video/webm' });
        for (const track of mediaStream.getTracks()) track.stop();
        streamRef.current = null;
        setStream(null);
        setStatus('stopped');
        onStop(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : '録画を開始できませんでした');
      setStatus('error');
    }
  }, [acquireStream, onStop]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return { status, stream, error, start, stop };
}
