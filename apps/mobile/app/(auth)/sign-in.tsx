import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { COLORS } from '../../lib/constants';

export default function SignInScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, name);
      
    setLoading(false);
    if (error) {
      setError(error.message);
    } else if (!isLogin) {
      // After sign up, can route to onboarding
      router.push('/(auth)/onboarding');
    } else {
      router.replace('/(session)/classroom');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setIsLogin(true)} style={[styles.tab, isLogin && styles.activeTab]}>
          <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLogin(false)} style={[styles.tab, !isLogin && styles.activeTab]}>
          <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Cadastrar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor={COLORS.TEXT_SECONDARY}
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.BACKGROUND} /> : <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Cadastrar'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND, padding: 20, justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginBottom: 20 },
  tab: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.GOLD },
  tabText: { color: COLORS.TEXT_SECONDARY, fontSize: 16 },
  activeTabText: { color: COLORS.GOLD, fontWeight: 'bold' },
  form: { gap: 15 },
  input: { backgroundColor: '#1A2A38', color: COLORS.TEXT_PRIMARY, padding: 15, borderRadius: 8, fontSize: 16 },
  button: { backgroundColor: COLORS.GOLD, padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: COLORS.BACKGROUND, fontSize: 16, fontWeight: 'bold' },
  errorText: { color: COLORS.ERROR, fontSize: 14 },
});
