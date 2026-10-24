import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';

export default [{
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', format: 'esm', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', exports: 'named', sourcemap: true },
  ],
  plugins: [typescript({ useTsconfigDeclarationDir: true })],
}, {
  input: 'src/browser.ts',
  output: { file: 'dist/track-events.global.js', format: 'iife', name: 'TrackEvents', sourcemap: true },
  plugins: [typescript({ useTsconfigDeclarationDir: true })],
}, {
  input: 'dist/types/index.d.ts',
  output: [
    { file: 'dist/index.d.ts', format: 'esm' },
    { file: 'dist/index.d.cts', format: 'esm' },
  ],
  plugins: [dts()],
}];
