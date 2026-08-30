import React from 'react';
import { Platform, Text, View } from 'react-native';
import ChalkBoard from './ChalkBoard';
import type { BoardEvent } from '@cenovia/shared';

// No Web, precisamos carregar o WASM do Skia primeiro
// @ts-ignore
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

export default function ChalkBoardWrapper(props: Props) {
  if (Platform.OS === 'web') {
    return (
      <WithSkiaWeb
        opts={{ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` }}
        getComponent={() => import('./ChalkBoard')}
        fallback={<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: 'white'}}>Carregando Quadro...</Text></View>}
      />
    );
  }

  // No iOS/Android, o Skia já é nativo
  return <ChalkBoard {...props} />;
}
