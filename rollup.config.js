import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        dir: 'dist/lib',
        format: 'cjs',
        sourcemap: true,
        // manualChunks: manualChunks,
        chunkFileNames: '[name].js',
        entryFileNames: '[name].js',
      },
      {
        dir: 'dist',
        format: 'esm',
        sourcemap: true,
        // manualChunks: manualChunks,
        chunkFileNames: '[name].js',
        entryFileNames: '[name].js',
        // exports: 'default',
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({ browser: true }),
      commonjs(),
      typescript({ useTsconfigDeclarationDir: true, declarationDir: 'lib' }),
    ],
  },
];
