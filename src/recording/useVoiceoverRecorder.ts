import { useCallback } from 'react';
import { useMediaStreamRecorder, type MediaStreamRecorder } from './useMediaStreamRecorder';

export function useVoiceoverRecorder(onStop: (blob: Blob) => void): MediaStreamRecorder {
  const acquire = useCallback(() => navigator.mediaDevices.getUserMedia({ audio: true }), []);
  return useMediaStreamRecorder(acquire, onStop);
}
