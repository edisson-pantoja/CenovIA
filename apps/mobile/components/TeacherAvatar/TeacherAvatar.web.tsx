import React from 'react';
import { View, StyleSheet } from 'react-native';
import SpeakingIndicator from './SpeakingIndicator';

export type TeacherState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface TeacherAvatarProps {
  state: TeacherState;
}

// Versao web: sem Lottie (nativo). Mostra apenas o SpeakingIndicator animado.
export default function TeacherAvatar({ state }: TeacherAvatarProps) {
  return (
    <View style={styles.container}>
      <SpeakingIndicator state={state} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
