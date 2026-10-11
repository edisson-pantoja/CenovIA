import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../lib/constants';

interface UsageBannerProps {
  minutesRemaining?: number;
  minutesLimit?: number;
  minutes?: number;
}

export default function UsageBanner({ minutesRemaining, minutesLimit, minutes }: UsageBannerProps) {
  const remaining = typeof minutesRemaining === 'number'
    ? minutesRemaining
    : (typeof minutes === 'number' ? minutes : 30);

  const isWarning = remaining < 5;
  const isDanger = remaining <= 0;

  let color = COLORS.SUCCESS;
  if (isWarning) color = COLORS.WARNING;
  if (isDanger) color = COLORS.ERROR;

  const limitText = typeof minutesLimit === 'number' ? ` de ${minutesLimit}` : '';

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={styles.text}>
        {Math.max(0, Math.round(remaining * 10) / 10)} min{limitText} restantes este mês
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 5, alignItems: 'center', justifyContent: 'center' },
  text: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: 'bold' }
});
