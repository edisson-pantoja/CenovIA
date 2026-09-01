// skia-stub.web.js
// Stub vazio do @shopify/react-native-skia para o build web.
// O ChalkBoard usa ChalkBoardWrapper.web.tsx no navegador (Canvas HTML5),
// entao o Skia nativo nunca eh carregado.
const React = require('react');
const noop = () => null;
const noopEl = () => React.createElement('div', null);
module.exports = {
  Canvas: noopEl,
  Text: noopEl,
  Rect: noopEl,
  Circle: noopEl,
  Path: noopEl,
  Group: noopEl,
  useFont: () => null,
  useSharedValue: (v) => ({ value: v }),
  useDerivedValue: (fn) => ({ value: fn() }),
  useComputedValue: (fn) => ({ value: fn() }),
  Skia: { Font: null, Paint: null, Path: null },
};
