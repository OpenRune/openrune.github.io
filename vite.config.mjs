import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

export default defineConfig(({ mode }) => {
  return {
    // Since it's deploying to https://openrune.github.io/ (root path), base is '/'
    base: mode === 'production' ? '/' : './',

    build: {
      outDir: 'dist', // Ensure build output goes to the dist directory
      sourcemap: mode === 'production',
    },

    css: {
      postcss: {
        plugins: [
          autoprefixer(), // Add options if needed
        ],
      },
    },

    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },

    optimizeDeps: {
      force: true,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },

    plugins: [react()],

    resolve: {
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },

    server: {
      port: 3000,
      proxy: {
        // Add proxy configuration if needed
      },
    },
  }
})
