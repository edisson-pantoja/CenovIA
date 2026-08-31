import React, { Component, ErrorInfo } from 'react';
import { Text, View } from 'react-native';
import type { BoardEvent } from '@cenovia/shared';

// @ts-ignore
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, errorMsg: string}> {
  state = { hasError: false, errorMsg: '' };
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error?.message || 'Erro no Quadro' }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Skia Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text style={{color:'red'}}>Erro ao renderizar Skia: {this.state.errorMsg}</Text></View>;
    return this.props.children;
  }
}

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

export default function ChalkBoardWrapper(props: Props) {
  return (
    <ErrorBoundary>
      <WithSkiaWeb
        opts={{ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` }}
        getComponent={() => import('./ChalkBoard')}
        fallback={<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: 'white'}}>Carregando Quadro...</Text></View>}
      />
    </ErrorBoundary>
  );
}
