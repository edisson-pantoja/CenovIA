import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TeacherState } from './TeacherAvatar';
import { COLORS } from '../../lib/constants';

export default function SpeakingIndicator({ state }: { state: TeacherState }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'idle') return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [state]);

  if (state === 'idle') return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
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
