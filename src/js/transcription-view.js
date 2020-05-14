import * as util from './util';
import cssModify from "css-modify";
import emptyPromise from 'empty-promise'

const VIEWING = 'viewing';
const EDITING = 'editing';
const LOADING = 'loading';
const ERROR = 'ERROR';

const VIEW_MODE_TEXT = 'text';
const VIEW_MODE_LYRICS = 'lyrics';


export default class TranscriptionView extends util.Observer {

    defaultParams = {
        viewMode: VIEW_MODE_TEXT,
    };

    viewModes = [
        VIEW_MODE_TEXT, 
        VIEW_MODE_LYRICS
    ];

    /** @private */
    stateBehaviors = {
        [VIEWING]: {
            init() {
                this.container && this.container.classList.add('viewing');

                console.log('viewing init waiting to resolve', this.transcription);
                Promise.resolve(this.transcription)
                .then(transcription => {
                    console.log('this.transcription resolved');
                    util.mustacheHelpers.enumerate(transcription);
                    this.container.innerHTML = require('../html/transcription-view.html')({
                        transcription: transcription
                    });

                    this.container.querySelectorAll('.tp-tv-line').forEach((element, index) => {
                        // element.addEventListener('dblclick', event => (() => this.fireEvent('goto', transcription[index].start)).call(this, event));
                        element.addEventListener('dblclick', event => (() => this.fireEvent('goto', index)).call(this, event));
                    }, this);
                });
            },
            destroy() {
                this.container && this.container.classList.remove('viewing');

                // remove all children from `this.container`
                while (this.container.firstChild) {
                    this.container.removeChild(this.container.lastChild);
                }
            },
        },
        [EDITING]: {
            init() {
                this.container && this.container.classList.add('editing');

                console.log('editing init waiting to resolve');
                Promise.resolve(this.transcription).then(transcription => {

                    let sections = [];
                    transcription.forEach((line, index) => {
                        line.words = line.text.split(' ').map(word => { return { word: word + ' ' } });
                        if (line.end !== undefined && line.start !== undefined) {
                            line['section?'] = true;
                            sections.push(index);
                        }
                    });
                    console.log('this.transcription resolved in editing', transcription, 'sections:', sections);
                    this.container.innerHTML = require('../html/transcription-view--editing.html')({
                        transcription: transcription
                    });

                    Array.prototype.slice.call(this.container.querySelectorAll('.selected')).forEach((section, index) => {
                        this.fireEvent('section-created', {
                            section: section,
                            start: transcription[sections[index]].start,
                            end: transcription[sections[index]].end,
                            init: true,
                        });
                    });
                });
                
            },
            destroy() {
                this.container && this.container.classList.remove('editing');

                // remove all children from `this.container`
                while (this.container.firstChild) {
                    this.container.removeChild(this.container.lastChild);
                }
            },
        },
        [LOADING]: {
            init() {

            },
            destroy() {

            },
        },
        [ERROR]: {
            init() {},
            destroy() {},
        },
    };

    static create(container, params) {
        var transcriptionView = new TranscriptionView(container, params);
        return transcriptionView.init();
    }

    constructor(container, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);

        this.validateParams();

        /**
         * @type {HTMLElement} 
         * @private */
        this.container = container;

        /** @private */
        this.states = {
            [VIEWING]: Object.create(this.stateBehaviors[VIEWING]),
            [EDITING]: Object.create(this.stateBehaviors[EDITING]),
            [LOADING]: Object.create(this.stateBehaviors[LOADING]),
            [ERROR]: Object.create(this.stateBehaviors[ERROR]),
        };

        /** @private */
        this.viewMode = null;

        /**
         * @public
         * @type {boolean} ready Whether view is ready
         */
        this.ready = false;

        /**
         * @type {Promise}
         */
        let _currentTranscriptionPromise = undefined;
        let _transcription = undefined;
        Object.defineProperty(this, 'transcription', {
            set: transcription => {
                _transcription = transcription
                if (_transcription && _currentTranscriptionPromise) {
                    _currentTranscriptionPromise.resolve(transcription);
                    _currentTranscriptionPromise = undefined;
                }
            },
            get: () => {
                if (_transcription) {
                    return _transcription;
                } else if (!_currentTranscriptionPromise) {
                    _currentTranscriptionPromise = emptyPromise();
                }
                return _currentTranscriptionPromise;
            }
        });

        return this;
    }

    init() {
        require('../css/transcription-view.css');
        this.css = new cssModify();
        const spaceWidth = util.html.textMetrics("-", this.container).width;
        this.css.modify('space-width', spaceWidth + 'px');

        this.container.classList.add('tp-tv-container');
        
        this.setViewMode(this.params.viewMode);
        this.setState(VIEWING);

        this.ready = true;
        this.fireEvent('ready');
        return this;
    }

    validateParams() {
        // check whether the preload attribute will be usable and if not log
        // a warning listing the reasons why not and nullify the variable
        const paramsIgnoreReasons = {
            viewMode: {
                validate: () => this.params.viewMode in this.viewModes,
                reason: 'View mode is invalid.',
                hint: 'Must be one of ' + JSON.stringify(this.viewModes) + '.',
            }
        };
        const invalidParams = Object.keys(paramsIgnoreReasons).filter(
            param => paramsIgnoreReasons[param].validate.call(this)
        );
        if (invalidParams.length) {
            console.warn(
                'The following parameters will be igrored:\n\t- ' + Object.keys(invalidParams).map(
                    param => invalidParams[param].reason + ' ' + invalidParams[param].hint
                ).join('\n\t- ')
            );

            // stop invalid values from being used
            Object.keys(invalidParams).forEach(
                param => this.params[param] = this.defaultParams[param]
            );
        }
    }

    /** 
     * @public
     * @description Load transcription
     * @param {Promise | Array} promiseOrArray
     * @returns {Promise}
    */
    load(promiseOrArray) {
        if (!this.ready) {
            console.error('Init must be called first.');
            return
        }
        this.transcription = undefined;
        // this.setState(LOADING);
        console.log('@TranscriptionView/load', promiseOrArray);
        return Promise.resolve(promiseOrArray).then(transcription => {
            console.log(transcription);
            // util.mustacheHelpers.enumerate(transcription);
            // this.container.innerHTML = require('../html/transcription-view.html')({
            //     transcription: transcription
            // });

            // this.container.querySelectorAll('.tp-tv-line').forEach(
            //     (element, index) => element.addEventListener('dblclick', 
            //         event => (
            //             () => this.fireEvent('goto', transcription[index].start)
            //         ).call(this, event)
            //     ), this);

            // this.setState(VIEWING);
            this.transcription = transcription;
            return transcription;
        }).catch(error => {
            // this.setState(ERROR);
            this.fireEvent('error', error);
            return null;
        });
    }

    /**
     * @private
     *
     * @param {string} state The new state
     */
    setState(state) {
        if (this.state !== this.states[state]) {
            if (this.state) {
                this.state.destroy.call(this);
            }
            this.state = this.states[state];
            this.state.init.call(this);
        }
    }

    /**
     * @public
     */
    setStateEditing() {
        this.setState(EDITING);
    }

    setStateViewing() {
        this.setState(VIEWING);
    }

    /**
     * @public
     * 
     * @param {string} viewMode How we want to wiew the transcription
     */
    setViewMode(viewMode) {
        // console.log('@setViewMode', viewMode);
        if (this.viewModes.indexOf(viewMode) !== -1) {
            if (viewMode !== this.viewMode) {
                this.container.classList.remove('view-mode--' + this.viewMode);
                this.container.classList.add('view-mode--' + viewMode);
                this.viewMode = viewMode;
            }
            return true;
        } else {
            return false;
        }
    }

    set isLyricsMode(b) {
        // console.log('@TranscriptionView/set isLyricsMode', b);
        if (b === true) {
            this.setViewMode(VIEW_MODE_LYRICS);
            return true;
        } else if (b === false) {
            this.setViewMode(VIEW_MODE_TEXT);
            return true;
        }
        return false;
    }

    get isLyricsMode() {
        // console.log('@TranscriptionView/get isLyricsMode');
        return this.viewMode === VIEW_MODE_LYRICS;
    }

    /**
     * @public
     * @param {int} index Index of current line
     */
    setLineAsCurrent(index) {
        // console.log('@setLineAsCurrent', index);
        if (this._currentLineIndex === index) {
            return
        }
        var currentLine = null;
        var nextLine = null;
        var previousLine = null;

        currentLine = this.container.querySelector('.tp-tv-line--current');
        var prevCurrentLineIndex = currentLine ? currentLine.id.split('-')[1] : null;
        if (index == prevCurrentLineIndex) {
            return;
        }
        currentLine && currentLine.classList.remove('tp-tv-line--current');
        currentLine && currentLine.classList.remove('tp-tv-line--active');

        previousLine = this.container.querySelector('.tp-tv-line--previous');
        previousLine && previousLine.classList.remove('tp-tv-line--previous');

        nextLine = this.container.querySelector('.tp-tv-line--next');
        nextLine && nextLine.classList.remove('tp-tv-line--next');

        currentLine = this.container.querySelector('#tp-tv-line-' + index);
        currentLine && currentLine.classList.add('tp-tv-line--current');

        previousLine = this.container.querySelector('#tp-tv-line-' + (index - 1));
        previousLine && previousLine.classList.add('tp-tv-line--previous');

        nextLine = this.container.querySelector('#tp-tv-line-' + (index + 1));
        nextLine && nextLine.classList.add('tp-tv-line--next');

        this._currentLineIndex = index;
        if (this._currentLineIndex !== this._activeLineIndex) {
            this._activeLineIndex = null;
        }
    }

    /**
     * @public
     * @param {int} index Index of current line
     */
    setLineAsActive(index) {
        // console.log('@setLineAsActive', index, this._activeLineIndex, this._currentLineIndex);
        if (this._activeLineIndex === index && this._currentLineIndex === index) {
            return;
        }
        var activeLine = null;

        activeLine = this.container.querySelector('tp-tv-line--active');
        var activeLineIndex = activeLine ? activeLine.id.split('-')[1] : null;
        if (activeLineIndex === index) {
            activeLine && activeLine.classList.remove('tp-tv-line--active');
        }

        // IF NOT index-th line is marked as current
        activeLine = this.container.querySelector('#tp-tv-line-' + index);
        if (activeLine && !activeLine.classList.contains('tp-tv-line--current')) {
            this.setLineAsCurrent(index);
        }

        // set index-th line as active
        activeLine && activeLine.classList.add('tp-tv-line--active');
        this._activeLineIndex = index;
    }

    /**
     * @public
     * @param {float} progress from 0.0 to 1.0
     */
    setProgress(p) {
        this.css.modify('active-progress', (p * 100) + '%');
    }

}