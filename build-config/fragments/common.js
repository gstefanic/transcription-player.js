const path = require('path');
const webpack = require('webpack');
const datefns = require('date-fns');

const rootDir = path.resolve(__dirname, '..', '..');
const pckg = require(path.join(rootDir, 'package.json'));

// inject JS version number
const jsVersionPlugin = new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(pckg.version)
});

module.exports = {
    context: rootDir,
    mode: 'development',
    output: {
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    performance: {
        hints: false
    },
    module: {
        rules: [
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                loader: 'url-loader',
                options: {
                    esModule: false,
                },
            },
            {
                test: /\.html$/,
                loader: 'mustache-loader',
                // loader: 'mustache-loader?minify'
                // loader: 'mustache-loader?{ minify: { removeComments: false } }'
                // loader: 'mustache-loader?noShortcut'
            },
            {
                test: /\.html$/i,
                loader: 'html-loader',
                options: {
                    minimize: {
                        removeComments: true,
                        collapseWhitespace: true,
                    },
                },
            },
            {
                test: /\.css$/i,
                use: [
                    'style-loader',
                    'css-loader',
                ],
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    'style-loader',
                    // Translates CSS into CommonJS
                    'css-loader',
                    // Compiles Sass to CSS
                    'sass-loader',
                ],
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader'
                    },
                ],
            }
        ]
    },
    plugins: [
        jsVersionPlugin,
    ]
};
