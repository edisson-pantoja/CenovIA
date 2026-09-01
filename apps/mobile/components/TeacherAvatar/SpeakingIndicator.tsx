import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TeacherState } from './TeacherAvatar';
import { COLORS } from '../../lib/constants';
import Animated, { useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

export default function SpeakingIndicator({ state }: { state: TeacherState }) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withRepeat(withSequence(withTiming(0.5, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true),
    };
  });

  if (state === 'idle') return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {state === 'listening' && <Text style={styles.text}>Ouvindo...</Text>}
      {state === 'thinking' && <Text style={styles.text}>Pensando...</Text>}
      {state === 'speaking' && <Text style={styles.text}>Falando...</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  text: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
