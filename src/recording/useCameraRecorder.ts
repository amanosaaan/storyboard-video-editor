import { useCallback } from 'react';
import { useMediaStreamRecorder, type MediaStreamRecorder } from './useMediaStreamRecorder';

export function useCameraRecorder(onStop: (blob: Blob) => void): MediaStreamRecorder {
  const acquire = useCallback(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }), []);
  return useMediaStreamRecorder(acquire, onStop);
}
