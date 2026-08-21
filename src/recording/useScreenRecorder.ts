import { useCallback } from 'react';
import { useMediaStreamRecorder, type MediaStreamRecorder } from './useMediaStreamRecorder';

export function useScreenRecorder(onStop: (blob: Blob) => void): MediaStreamRecorder {
  const acquire = useCallback(() => navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }), []);
  return useMediaStreamRecorder(acquire, onStop);
}
