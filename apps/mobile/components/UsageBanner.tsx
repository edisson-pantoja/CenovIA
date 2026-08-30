import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../lib/constants';

export default function UsageBanner({ minutes }: { minutes: number }) {
  const isWarning = minutes < 5;
  const isDanger = minutes <= 0;

  let color = COLORS.SUCCESS;
  if (isWarning) color = COLORS.WARNING;
  if (isDanger) color = COLORS.ERROR;

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={styles.text}>{Math.max(0, minutes)} min restantes este mês</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 5, alignItems: 'center', justifyContent: 'center' },
  text: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: 'bold' }
});
