const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        transcriptionPlayer: path.join(rootDir, 'src', 'js', 'transcription-player.js')
    },
    output: {
        path: path.join(rootDir, 'dist'),
        filename: '[name].js',
        library: 'TranscriptionPlayer',
        globalObject: 'this',
    },
    plugins: [banner.libBanner]
};
