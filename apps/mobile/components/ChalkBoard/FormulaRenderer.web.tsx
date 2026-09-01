import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../lib/constants';

interface FormulaRendererProps {
  type: 'latex' | 'smiles';
  formula: string;
}

export default function FormulaRenderer({ type, formula }: FormulaRendererProps) {
  return (
    <View style={{ width: 200, height: 100, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.CHALK_WHITE, fontSize: 24, fontFamily: 'Caveat' }}>
        {formula}
      </Text>
    </View>
  );
}
