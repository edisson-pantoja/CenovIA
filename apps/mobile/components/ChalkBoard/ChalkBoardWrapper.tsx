import React from 'react';
import ChalkBoard from './ChalkBoard';
import type { BoardEvent } from '@cenovia/shared';

interface Props {
  events?: BoardEvent[];
  replayTimeMs?: number;
}

export default function ChalkBoardWrapper(props: Props) {
  // No iOS/Android, o Skia já é nativo
  return <ChalkBoard {...props} />;
}
