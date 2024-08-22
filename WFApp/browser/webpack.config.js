// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * See also webpack.config.hot.js, which is a fork of this file.
 * Please make changes in both places if applicable.
 */

/* eslint-disable */
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const CspHtmlWebpackPlugin = require('csp-html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
// /* eslint-enable */

// /**
//  * This is exactly what we document in the CSP guide.
//  */
// const csp = {
//   'connect-src': "'self' data: https://*.chime.aws wss://*.chime.aws https://*.amazonaws.com",

//   // 'wasm-unsafe-eval' is to allow Amazon Voice Focus to work in Chrome 95+.
//   // Strictly speaking, this should be enough, but the worker cannot compile WebAssembly unless
//   // 'unsafe-eval' is also present.
//   'script-src': "'self' 'unsafe-eval' blob: 'wasm-eval' 'wasm-unsafe-eval'",

//   // Script hashes/nonces are not emitted for script-src-elem, so just add unsafe-inline.
//   'script-src-elem': "'self' 'unsafe-inline' blob:",
//   'worker-src': "'self' blob:",
//   'child-src': "'self' blob:",
// };

// // Modify our basic CSP to allow several things:
// // 1. Access to assets in all stages for testing and canaries.
// for (const stage of ['a', 'b', 'g', '']) {
//   const host = ` https://*.sdkassets.${stage}chime.aws`;
//   const media = ` wss://*.${stage}chime.aws`;
//   csp['connect-src'] += host + media;
//   csp['script-src'] += host;
//   csp['script-src-elem'] += host;
// }

// // 2. Access to googleapis for the Segmentation filter 
// csp['connect-src'] += ' https://storage.googleapis.com';

// // 3. Access to jsdelivr for TensorFlow for background blur.
// csp['script-src'] += ' https://cdn.jsdelivr.net';
// csp['script-src-elem'] += ' https://cdn.jsdelivr.net';

// // 4. Add 'unsafe-eval' because TensorFlow needs it.
// if (!csp['script-src'].includes("'unsafe-eval'")) {
//   csp['script-src'] += " 'unsafe-eval'";
// }

// // 5. Access to event ingestion gamma endpoint for testing and canaries.
// csp['connect-src'] += ' https://*.ingest.gchime.aws ';

module.exports = env => {
  console.info('Env:', JSON.stringify(env, null, 2));
  console.info('App:', process.env.npm_config_app);
  const app = env.app || process.env.npm_config_app || 'workout';
  console.info('Using app', app);
  return {
    devServer: {
      devMiddleware: {
        index: `workout.html`
      },
      onListening: (server) => {
        // Just so that the code in server.js isn't confused about
        // which app finally made it through the gauntlet.
        process.env.npm_config_app = workout;
        const { serve } = require('./server.js');
        serve('127.0.0.1:8081');
      },
      static: {
        publicPath: '/',
      },
      port: 8080,
      proxy: {
        '/join': 'http://127.0.0.1:8081',
        '/end': 'http://127.0.0.1:8081',
        '/fetch_credentials': 'http://127.0.0.1:8081',
      }
    },
    plugins: [
      // new CspHtmlWebpackPlugin(csp),
      new webpack.ProvidePlugin({
        $: "jquery",
        jquery: "jquery",
        "window.jQuery": "jquery",
        jQuery:"jquery"
      }),
      new HtmlWebpackPlugin({
        inlineSource: '.(js|css)$',
        template: __dirname + '/app/workout/workout.html',
        filename: __dirname + '/dist/workout.html',
        inject: 'head',
        chunks: ['workout'],
      }),
      new HtmlWebpackPlugin({
        inlineSource: '.(js|css)$',
        template: __dirname + '/app/bot/bot.html',
        filename: __dirname + '/dist/bot.html',
        inject: 'head',
        chunks: ['bot'],
      }),
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [new RegExp(`bot`)]),
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [new RegExp(`workout`)]),
      new webpack.EnvironmentPlugin({
        IS_LOCAL: process.env.npm_config_is_local === 'true' ? 'true' : 'false'
      })
    ],
    entry: {
      workout:'./app/workout/workout.ts',
      bot:'./app/bot/bot.ts'
    },
    resolve: {
      extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
    },
    output: {
      path: __dirname + '/dist',
      chunkFilename: '[id].bundle_[chunkhash].js',
      sourceMapFilename: '[file].map',
      publicPath: '/',
      libraryTarget: 'var',
      library: 'app_[name]',
    },
    module: {
      rules: [
        {
          test: /\.(svg)$/,
          loader: 'raw-loader',
        },
        {
          test: /\.(sass|css|scss)$/,
          use: [{
            loader: 'style-loader',
            options: {
              insert: 'head',
            },
          }, {
            loader: 'css-loader',
          }, {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  // "precss",
                  "autoprefixer"                  
                ]
              }
            },
          }, {
            loader: 'sass-loader',
          }]
        },
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
        },
        {
          test: /\.(jpg|png|gif|svg|ico)$/,
          exclude: [/node_modules/, __dirname + '/dist/[name].html'],
          use: [{
              loader: 'file-loader',
              options: {
                  name: '[name].[ext]',
                  outputPath: '/img',
                  esModule: false
              }
          }]
        },
      ],
    },
    mode: 'development',
    performance: {
      hints: false,
    },
  };
};
