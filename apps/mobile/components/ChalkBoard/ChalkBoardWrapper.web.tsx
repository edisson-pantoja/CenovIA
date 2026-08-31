import React from 'react';
import { Text, View } from 'react-native';
import type { BoardEvent } from '@cenovia/shared';

// No Web, carregamos de forma estrita via lazy import para não avaliar o pacote Skia prematuramente
// @ts-ignore
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

export default function ChalkBoardWrapper(props: Props) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}` }}
      getComponent={() => import('./ChalkBoard')}
      fallback={<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: 'white'}}>Carregando Quadro...</Text></View>}
    />
  );
}
