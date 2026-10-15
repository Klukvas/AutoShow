import config from '../../../next.config.mjs';
export default { ...config, output: undefined, outputFileTracingRoot: import.meta.dirname, distDir: '.next' };
