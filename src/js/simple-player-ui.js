import * as util from './util';

const PLAYING = 'playing';
const PAUSED = 'paused';

export default class SimplePlayerUI extends util.Observer {

    defaultParams = {};

    static create(container, params) {
        var simplePlayerUI = new SimplePlayerUI(container, params);
        return simplePlayerUI.init();
    }

    constructor(container, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);
        this.container = container;

        this.playBtn = null;
        this.progressBar = null;
        this.preloadBar = null;

        this.eventHandlers = {
            onPlayButtonClicked: () => {
                this.fireEvent(this.playBtn.classList.contains('playing') ? 'pause' : 'play')
            },
            onProgressBarMouseDown: event => {
                console.log('onProgressBarMouseDown');console.log('onProgressBarMouseDown');
                this.rightClick = (event.which === 3) ? true : false;
                this.seeking = true;
                return this.eventHandlers.onProgressBarMouseMove(event);
            },
            onProgressBarMouseMove: event => {
                if (this.seeking && this.rightClick === false) {
                    var value = ((event.offsetX - this.progressBar.offsetLeft)) / this.progressBar.parentNode.offsetWidth;
                    console.log('onProgressBarMouseMove', value);
                    // this.moveProgressBar(value);
                    this.fireEvent('seek', value);
                    return value;
                }
            },
            onDocumentMouseUp: () => {
                console.log('onDocumentMouseUp');
                this.seeking = false;
            },
        };
        
        /** @private */
        this.stateBehaviors = {
            [PLAYING]: {
                init() {
                    this.playBtn.classList.add('playing');
                },
            },
            [PAUSED]: {
                init() {
                    this.playBtn.classList.remove('playing');
                },
            }
        };

        /** @private */
        this.states = {
            [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
            [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
        };

        return this;
    }

    init() {
        this.createUI();
        this.addEventListeners();
        this.setState(PAUSED);
        return this;
    }

    destroy() {
        
    }

    /**
     * @private
     */
    createUI() {
        require('../css/simple-player.css');
        this.container.innerHTML = require('../html/simple-player.html')();

        /* get references to UI elements */
        this.playBtn = this.container.querySelector('.tp-simple-player-toggle-btn');
        this.progressBar = this.container.querySelector('.tp-simple-player-bar');
    	this.preloadBar = this.container.querySelector('.tp-simple-player-preload-bar');

        return this.container;
    }

    /**
     * @private
     */
    addEventListeners() {
        // the following event listeners will be destroyed by
        // nullifying the DOM node references after removing them
        this.playBtn.addEventListener('click', event => this.eventHandlers.onPlayButtonClicked.call(this, event));
        this.progressBar.parentNode.parentNode.addEventListener('mousedown', event => this.eventHandlers.onProgressBarMouseDown.call(this, event));
    	this.progressBar.parentNode.parentNode.addEventListener('mousemove', event => this.eventHandlers.onProgressBarMouseMove.call(this, event));
        document.documentElement.addEventListener('mouseup', event => this.eventHandlers.onDocumentMouseUp.call(this, event));
    }

    /**
     * @private
     *
     * @param {string} state The new state
     */
    setState(state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    }

    setPlaying() {
        this.setState(PLAYING);
    }
    
    setPaused() {
        this.setState(PAUSED);
    }

    moveProgressBar(value) {
        // console.log('SimplePlayerUI/moveProgressBar', value);
        this.progressBar.style.width = (value * 100) + '%';
    }

    onTimeUpdated(time) { throw new Error('implementation error') }
    onPlayed() { throw new Error('implementation error') }
    onPaused() { throw new Error('implementation error') }
    onEnded() { throw new Error('implementation error') }
    onError() { throw new Error('implementation error') }
    onPlayingDisabled() { throw new Error('implementation error') }
    onPlayingEnabled() { throw new Error('implementation error') }
    
}