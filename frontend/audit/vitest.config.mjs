import {defineConfig,mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from '../vite.config.js';
export default mergeConfig(base,defineConfig({root:fileURLToPath(new URL('..',import.meta.url)),test:{include:['audit/*.audit.jsx']}}));
