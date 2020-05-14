const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        'html-init': path.join(rootDir, 'src', 'js', 'html-init.js')
    },
    output: {
        path: path.join(rootDir, 'dist'),
        filename: 'transcriptionPlayer-[name].js',
        library: ['TranscriptionPlayer', '[name]'],
        globalObject: 'this',
    },
    plugins: [banner.libBanner]
};
