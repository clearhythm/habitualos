const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');

const options = {
  entryPoints: ['src/widget/index.js'],
  bundle: true,
  format: 'iife',
  outfile: 'src/assets/js/signal-widget.js',
  minify: process.env.NODE_ENV === 'production',
  banner: { js: '/* Generated — edit src/widget/index.js instead */' },
  plugins: [sassPlugin({ type: 'style' })],
};

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  esbuild.context(options).then(ctx => {
    ctx.watch();
    console.log('[build-widget] watching for changes...');
  });
} else {
  esbuild.build(options).then(() => {
    console.log('[build-widget] done');
  });
}
