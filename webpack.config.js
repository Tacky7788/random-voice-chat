const path = require('path')
const fs = require('fs')

class CopySettingsHtmlPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('CopySettingsHtmlPlugin', () => {
      const src = path.resolve(__dirname, 'src/settings.html')
      const dest = path.resolve(__dirname, 'public/settings.html')
      fs.copyFileSync(src, dest)
    })
  }
}

module.exports = {
  entry: './src/index.ts',
  target: 'node',
  output: {
    filename: 'plugin.js',
    path: path.resolve(__dirname, 'public'),
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }
    ]
  },
  externals: {
    '@onecomme.com/onesdk': 'commonjs @onecomme.com/onesdk'
  },
  plugins: [new CopySettingsHtmlPlugin()]
}
