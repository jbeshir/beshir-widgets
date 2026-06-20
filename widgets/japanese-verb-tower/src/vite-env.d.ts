// Ambient declarations for non-code asset imports. Vite's bundler resolves
// CSS side-effect imports (e.g. `import './styles.css'`), but a bare
// `tsc --noEmit` typecheck has no declaration for them — this provides one so
// the type-check gate passes without a bundler.
declare module '*.css';
