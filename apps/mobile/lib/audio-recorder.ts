/**
 * audio-recorder.ts — Native (iOS/Android) stub.
 * On native platforms, recording is handled directly by AudioManager via expo-av.
 * This file exists so imports of audio-recorder don't fail on native.
 */

export class WebAudioRecorder {
  static isSupported(): boolean {
    return false; // Native uses expo-av directly
  }
  async start(): Promise<boolean> { return false; }
  async stop(): Promise<null> { return null; }
}

export const webAudioRecorder = new WebAudioRecorder();
