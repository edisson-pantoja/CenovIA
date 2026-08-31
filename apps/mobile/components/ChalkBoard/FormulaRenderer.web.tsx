import React from 'react';
import { View } from 'react-native';
import { COLORS } from '../../lib/constants';

interface FormulaRendererProps {
  type: 'latex' | 'smiles';
  formula: string;
}

export default function FormulaRenderer({ type, formula }: FormulaRendererProps) {
  const htmlContent = `
    <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css">
        <style>
          body { margin: 0; background-color: transparent; color: ${COLORS.CHALK_WHITE}; display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 32px; }
        </style>
      </head>
      <body>
        <div id="formula"></div>
        <script>
          if ('${type}' === 'latex') {
            katex.render('${formula.replace(/\\/g, '\\\\')}', document.getElementById('formula'));
          } else {
            document.getElementById('formula').innerText = '${formula}';
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ width: 200, height: 100, backgroundColor: 'transparent' }}>
      <iframe 
        srcDoc={htmlContent} 
        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }} 
      />
    </View>
  );
}
