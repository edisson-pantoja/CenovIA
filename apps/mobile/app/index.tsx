import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';

export default function Index() {
  const { session, loading } = useAuth();
  const { studyContext } = useSession();

  if (loading) return null;

  if (session) {
    // Se já tem contexto de estudo (matéria escolhida), vai para a aula
    if (studyContext) {
      return <Redirect href="/(session)/classroom" />;
    }
    // Senão, vai para o onboarding para escolher nível e matéria
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
