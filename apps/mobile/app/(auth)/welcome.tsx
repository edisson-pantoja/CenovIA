import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS } from '../../lib/constants';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={['#0F1923', COLORS.CHALKBOARD_GREEN]} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>CenovIA</Text>
        <Text style={styles.subtitle}>Sua professora particular sempre disponível</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/sign-in')}>
        <Text style={styles.buttonText}>Começar</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.GOLD,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.GOLD,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonText: {
    color: COLORS.BACKGROUND,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
