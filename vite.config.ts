import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "babylon-runtime",
              test: /node_modules[\\/]@babylonjs[\\/]/,
              priority: 20,
              minSize: 120 * 1024,
              maxSize: 950 * 1024,
            },
            {
              name: "vendor-runtime",
              test: /node_modules/,
              priority: 10,
              minSize: 80 * 1024,
              maxSize: 500 * 1024,
            },
          ],
        },
      },
    },
  },
});
