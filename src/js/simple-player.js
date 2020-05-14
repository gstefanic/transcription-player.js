import * as util from './util';
import SimplePlayerUI from './simple-player-ui';
import WebAudio from './webaudio';

export default class SimplePlayer extends util.Observer {

    defaultParams = {};

    static create(container, params) {
        var simplePlayer = new SimplePlayer(container, params);
        return simplePlayer.init();
    }

    constructor(container, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);
        
        this.container = container;

        /** @private HTML element for controlling audio playback */
        this.ui = null;

        /** @private WebAudio component */
        this.wa = null;

        /** @private time in seconds when WebAudio has been paused */
        this.pausedAt = null

        /**
         * @private Will hold a list of event descriptors that need to be
         * canceled on subsequent loads of audio
         * @type {Object[]}
         */
        this.tmpEvents = [];

        /**
         * @private Holds any running audio downloads
         * @type {Observer}
         */
        this.currentRequest = null;
        /** @private */
        this.arraybuffer = null;

        /** @private */
        this.isDestroyed = false;

        /**
         * Get the current ready status.
         *
         * @example const isReady = wavesurfer.isReady;
         * @return {boolean}
         */
        this.isReady = false;

        return this;
    }

    init() {
        console.log('SimplePlayer/init', this.params);
        this.ui = SimplePlayerUI.create(this.container, this.params);
        this.wa = new WebAudio(this.params);
        this.wa.init();
        
        this.params.preload && 
            this.load();

        this.ui.on('play', () => this.play());

        this.ui.on('pause', () => this.pause());

        this.ui.on('seek', value => this.seek(value));

        this.wa.on('audioprocess', time => {
            // console.log('onAudioProcess', time);
            this.ui.moveProgressBar(time / this.getDuration())
        });

        this.wa.on('pause', () => this.pausedAt = this.wa.getCurrentTime());

        this.wa.on('finish', () => this.stop());

        return this;
    }

    destroy() {
        // TODO
    }

    /**
     * Called while the audio file is loading
     *
     * @private
     * @param {Event} e Progress event
     * @emits SimplePlayer#loading
     */
    onProgress(e) {
        let percentComplete;
        if (e.lengthComputable) {
            percentComplete = e.loaded / e.total;
        } else {
            // Approximate progress with an asymptotic
            // function, and assume downloads in the 1-3 MB range.
            percentComplete = e.loaded / (e.loaded + 1000000);
        }
        this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
    }

    /**
     * Decode an array buffer and pass data to a callback
     *
     * @private
     * @param {Object} arraybuffer The array buffer to decode
     * @param {function} callback The function to call on complete
     */
    decodeArrayBuffer(arraybuffer, callback) {
        this.arraybuffer = arraybuffer;
        this.wa.decodeArrayBuffer(
            arraybuffer,
            data => {
                // Only use the decoded data if we haven't been destroyed or
                // another decode started in the meantime
                if (!this.isDestroyed && this.arraybuffer == arraybuffer) {
                    callback(data);
                    this.arraybuffer = null;
                }
            },
            () => this.fireEvent('error', 'Error decoding audiobuffer')
        );
    }

    /**
     * Directly load an externally decoded AudioBuffer
     *
     * @private
     * @param {AudioBuffer} buffer Buffer to process
     * @emits SimplePlayer#ready
     */
    loadDecodedBuffer(buffer) {
        this.wa.load(buffer);
        this.isReady = true;
        this.fireEvent('ready');
    }

    /**
     * Decode buffer and load
     *
     * @private
     * @param {ArrayBuffer} arraybuffer Buffer to process
     */
    loadArrayBuffer(arraybuffer) {
        this.decodeArrayBuffer(arraybuffer, data => {
            if (!this.isDestroyed) {
                this.loadDecodedBuffer(data);
            }
        });
    }

    /**
     * Load an array buffer using fetch and pass the result to a callback
     *
     * @param {string} url The URL of the file object
     * @param {function} callback The function to call on complete
     * @returns {util.fetchFile} fetch call
     * @private
     */
    getArrayBuffer(url, callback) {
        let options = Object.assign(
            {
                url: url,
                responseType: 'arraybuffer'
            },
            this.params.xhr
        );
        const request = util.fetchFile(options);

        this.currentRequest = request;

        this.tmpEvents.push(
            request.on('progress', e => {
                this.onProgress(e);
            }),
            request.on('success', data => {
                callback(data);
                this.currentRequest = null;
            }),
            request.on('error', e => {
                this.fireEvent('error', e);
                this.currentRequest = null;
            })
        );

        return request;
    }

    load(url) {
        url = url ? url : this.params.audioUrl;
        console.log('url:', url);
        this.loading = true;
        this.getArrayBuffer(url, data => this.loadArrayBuffer(data));
    }

    play() {
        var _play = () => {
            this.wa.play(this.pausedAt ? this.pausedAt : 0, this.wa.getDuration());
            this.ui.setPlaying();
        };

        if (this.params.preload && this.isReady) {
            _play();
        } else if (!this.loading) {
            this.load()
            this.on('ready', () => this.loading = true && _play());
        }
    }

    pause() {
        this.wa.pause();
        this.ui.setPaused();
    }

    stop() {
        this.pausedAt = null;
        this.ui.setPaused();
    }

    seek(progress) {
        console.log('SimplePlayer/seek', progress);
        // return an error if progress is not a number between 0 and 1
        if (
            typeof progress !== 'number' ||
            !isFinite(progress) ||
            progress < 0 ||
            progress > 1
        ) {
            throw new Error(
                'Error calling wavesurfer.seekTo, parameter must be a number between 0 and 1!'
            );
        }
        
        const paused = this.wa.isPaused();
        if (!paused) {
            this.wa.pause();
        }
        this.wa.seekTo(progress * this.getDuration());

        if (!paused) {
            this.wa.play();
        }
        this.fireEvent('seek', progress);
    }

    getCurrentTime() {
        return this.wa.getCurrentTime();
    }

    getDuration() {
        return this.wa.getDuration();
    }

    getState() { throw new Error('implementation error') }
    isPaused() { throw new Error('implementation error') }
    
}