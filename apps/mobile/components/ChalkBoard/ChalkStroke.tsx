import React from 'react';
import { Path } from '@shopify/react-native-skia';
import { COLORS } from '../../lib/constants';

// Placeholder for animated stroke logic
export default function ChalkStroke({ pathData }: { pathData: string }) {
  return (
    <Path path={pathData} color={COLORS.CHALK_WHITE} style="stroke" strokeWidth={2} />
  );
}
