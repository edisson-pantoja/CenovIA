/**
 * SessionContext — Contexto global de sessão de estudo do CenovIA
 *
 * Mantém:
 *  - studyContext: matéria/série/nível selecionados no onboarding
 *  - currentSession: sessão de estudo ativa
 *  - usage: minutos usados no mês (atualizado pelo GeminiLiveClient)
 */

import React, { createContext, useContext, useState } from 'react';
import type { StudyContext, StudySession, UserUsage } from '@cenovia/shared';

interface SessionContextProps {
  studyContext: StudyContext | null;
  setStudyContext: (ctx: StudyContext) => void;
  currentSession: StudySession | null;
  setCurrentSession: (session: StudySession | null) => void;
  usage: UserUsage | null;
  setUsage: (usage: UserUsage) => void;
}

const SessionContext = createContext<SessionContextProps>({
  studyContext: null,
  setStudyContext: () => {},
  currentSession: null,
  setCurrentSession: () => {},
  usage: null,
  setUsage: () => {},
});

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [studyContext, setStudyContext] = useState<StudyContext | null>(null);
  const [currentSession, setCurrentSession] = useState<StudySession | null>(null);
  const [usage, setUsage] = useState<UserUsage | null>(null);

  return (
    <SessionContext.Provider
      value={{
        studyContext,
        setStudyContext,
        currentSession,
        setCurrentSession,
        usage,
        setUsage,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
