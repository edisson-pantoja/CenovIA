import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import SpeakingIndicator from './SpeakingIndicator';

export type TeacherState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface TeacherAvatarProps {
  state: TeacherState;
}

export default function TeacherAvatar({ state }: TeacherAvatarProps) {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.play();
    }
  }, [state]);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../../assets/animations/teacher-idle.json')}
        autoPlay
        loop
        style={styles.lottie}
      />
      <View style={styles.indicatorContainer}>
        <SpeakingIndicator state={state} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  }
});
