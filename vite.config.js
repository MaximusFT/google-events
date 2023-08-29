import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    commonjsOptions: {
      // esmExternals: true,
    },
    rollupOptions: {
      input: {
        app: './src/index.ts',
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
  },
});
