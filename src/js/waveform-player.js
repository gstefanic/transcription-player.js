import * as util from './util';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/src/plugin/regions.js';

export default class WaveformPlayer extends util.Observer {

    static create(params) {
        return new WaveformPlayer(params);
    }

    /**
     * @param {Object} params 
     */
    constructor(params) {
        super();

        const self = this;

        /**
         * @description Default object parameters
         */
        const defaultParams = {
            minZoomDuration: 10,
            justClickThreshold: 10,
        };
        
        /**
         * Extract relevant parameters (or defaults)
         */
        params = Object.assign({}, defaultParams, params);

        const container = params.container;
        
        /* Check container type */
        if (!(container instanceof HTMLElement)) {
            throw new TypeError('Invalid container type. Must be instance of HTMLElement class.');
        }

        /* Load stylesheets */
        require('../css/waveform-player.scss');

        /* Load view into container */
        container.innerHTML = require('../html/waveform-player.html')();

        let _scrollZoomEnabled = false;
        Object.defineProperty(this, 'scrollZoomEnabled', {
            set: enabled => _scrollZoomEnabled = enabled === true,
            get: () => _scrollZoomEnabled,
        });

        /**
         * @description On mouse wheel zoom handler
         * @param {Event} e 
         */
        const mouseWheelZoomHandler = (e => {
            if (_scrollZoomEnabled) {
                e = window.event || e;
                var delta = Math.max(-1, Math.min(1, (e.deltaY || e.wheelDelta || -e.detail)));

                delta < 0 ? zoomIn(0.1, e) : zoomOut(0.1, e);

                e.preventDefault();
            }
        }).limit(1);

        let _mouseMoveTimelineEnabled = true;
        Object.defineProperty(this, 'mouseMoveTimelineEnabled', {
            set: enabled => _mouseMoveTimelineEnabled = enabled === true,
            get: () => _mouseMoveTimelineEnabled,
        });

        let _moveTimelineActive = false;
        let _moveTimelineMouseDown = false;
        let _moveTimelineOE = null;
        let _moveTimelinePrevEvent = null;
        let _moveTimelineContainer = null;
        const moveTimelineHandlers = {
            mousedown: event => {
                const targets = document.elementsFromPoint(event.x, event.y);
                const isHandle = targets.some(target => target instanceof HTMLElement && target.classList.contains('wavesurfer-handle'));
                if (isHandle) {
                    return;
                }
                _moveTimelineMouseDown = _mouseMoveTimelineEnabled;
                _moveTimelinePrevEvent = event;
                _moveTimelineOE = event;
            },
            mouseup: event => {
                if (_moveTimelineOE) {
                    const targets = document.elementsFromPoint(_moveTimelineOE.x, _moveTimelineOE.y);
                    const regionElement = targets.find(target => target instanceof HTMLElement && target.classList.contains('wavesurfer-region'));
                    if (regionElement && _moveTimelineActive === false) {
                        const region = wavesurfer.regions.list[regionElement.dataset.id];
                        self.fireEvent('region-click', this.getRegionIndex(region), event, region);
                    }
                    _moveTimelineActive = false;
                    _moveTimelineMouseDown = false;
                    _moveTimelineOE = null;
                }
            },
            mousemove: event => {
                if (!_moveTimelineMouseDown || !_moveTimelineContainer) {
                    return;
                }
                const oe = _moveTimelinePrevEvent;
                _moveTimelineActive = _moveTimelineActive || Math.hypot((oe.x - event.x), (oe.y - event.y)) > params.justClickThreshold;

                if (!_moveTimelineActive) {
                    return;
                }

                const diffX = oe.x - event.x;

                _moveTimelineContainer.scrollLeft += diffX;

                _moveTimelinePrevEvent = event;
            },
        };

        /**
         * @description Register event handler for moving timeline with mouse drag
         * @param {WaveSurfer} wavesurfer 
         */
        const addMouseMoveTimeline = wavesurfer => {
            _moveTimelineContainer = wavesurfer.container.querySelector('wave');
            _moveTimelineContainer.addEventListener('mousedown', moveTimelineHandlers.mousedown);
            document.addEventListener('mouseup', moveTimelineHandlers.mouseup);
            document.addEventListener('mousemove', moveTimelineHandlers.mousemove);
        };

        /**
         * @description Register event handlers for mouse wheel zoom
         * @param {WaveSurfer} wavesurfer 
         */
        const addMouseWheelZoom = wavesurfer => {
            zoomReset(wavesurfer);
            wavesurfer.container.querySelector('wave').addEventListener('wheel', mouseWheelZoomHandler);
        };

        /**
         * @description Remove event handlers for mouse wheel zoom
         * @param {WaveSurfer} wavesurfer 
         */
        const removeMouseWheelZoom = wavesurfer => {
            wavesurfer.container.querySelector('wave').removeEventListener('wheel', mouseWheelZoomHandler);
        };

        /**
         * 
         * @param {HTMLElement} container 
         * @param {Object} params 
         * @returns {WaveSurfer}
         */
        const createWavesurfer = (container, params) => {
            if (!(container instanceof HTMLElement)) {
                throw new TypeError('container must be instance of HTMLElement');
            }

            const roundedBarsParams = {
                waveColor: '#D9DCFF',
                progressColor: '#4353FF',
                cursorColor: '#4353FF',
                barWidth: 3,
                barRadius: 3,
                cursorWidth: 1,
                height: container.offsetHeight,
                barGap: 3,
            };

            const defaultWavesurferParams = Object.assign({
                backend: 'MediaElement',
                mediaControls: false,
                fillParent: true,
                scrollParent: false,
            }, roundedBarsParams);

            params = Object.assign({}, defaultWavesurferParams, params, {
                container: container,
            });

            const wavesurfer = WaveSurfer.create(params);

            /* Add regions plugin */
            wavesurfer.addPlugin(RegionsPlugin.create());

            return wavesurfer;
        };

        /**
         * @description HTMLElement that stores Wavesurfer view
         * @type {HTMLElement}
         */
        const wavesurferContainer = container.querySelector('.tp-wavesurfer-container');

        /**
         * @type {WaveSurfer}
         */
        const wavesurfer = createWavesurfer(wavesurferContainer, params);

        wavesurfer.on('ready', () => {
            /* Add mouse wheel zoom */
            addMouseWheelZoom(wavesurfer);
            addMouseMoveTimeline(wavesurfer);
        });

        console.log('WaveformPlayer/wavesurfer', wavesurfer);

        /**
         * @description Add horizontal scroll to wavesurfer
         */
        // util.html.forceHorizontalScroll(wavesurfer.container.querySelector('wave'));

        /**
         * @description Initialize play-pause button, register event handlers and emit signals
         * @param {HTMLElement} container 
         */
        const initPlayButton = container => {
            if (!(container instanceof HTMLElement)) {
                throw new TypeError('container must be instance of HTMLElement');
            }

            if (wavesurfer.isPlaying()) {
                container.classList.add('playing');
            }

            wavesurfer.on('play', () => container.classList.add('playing'));
            wavesurfer.on('pause', () => container.classList.remove('playing'));

            container.addEventListener('click', event => container.classList.contains('playing') ? wavesurfer.pause() : wavesurfer.play());
        };

        /**
         * @type {HTMLElement}
         */
        const playButton = container.querySelector('.tp-waveform-play-button');

        initPlayButton(playButton);

        /**
         * @type {Region[]}
         */
        let regions = [];

        const clearRegions = () => {
            wavesurfer.clearRegions();
            regions = [];
        };

        /**
         * @returns {Region[]}
         */
        console.log('this:', this);
        this.getRegions = () => regions;

        /**
         * @param {Region} region 
         * @returns {number} index of region
         */
        const insertRegion = region => {
            let index = 0;
            while (index < regions.length && region.end > regions[index].start) {
                index++;
            }
            regions.splice(index, 0, region);
            return index;
        };

        /**
         * @description Add region
         * @param {Object} param0 
         * @returns {Object}
         */
        this.addRegion = ({start, end}) => {
            if (start < end) {
                const region = wavesurfer.addRegion({
                    start: start,
                    end: end,
                    drag: false,
                });
                
                if (region) {
                    const index = insertRegion(region);

                    // Add handlers for drag move timeline
                    region.element.addEventListener('mousedown', moveTimelineHandlers.mousedown);
        
                    return {
                        region: region,
                        index: index,
                    };
                }
            }

            return {
                region: undefined,
                index: -1,
            };
        };

        /**
         * @description Removes region by index
         * @param {number} index 
         * @returns {boolean} Whether action was successful
         */
        this.removeRegion = index => {
            if (index >= 0 && index < regions.length) {
                const region = regions[index];
                region.remove();
                regions.splice(index, 1);
                return true;
            } else {
                return false;
            }
        };

        /**
         * @description Returns region by index
         * @param {number} index 
         * @returns {Region}
         */
        this.getRegion = index => {
            return regions[index];
        };

        /**
         * @description Get region index
         * @param {Region} region 
         * @returns {number} Region index
         */
        this.getRegionIndex = region => regions.findIndex(r => r === region);

        /**
         * @description Play region
         * @param {number} index Index of region to play
         * @param {boolean} loop Whether to loop playing region
         */
        this.playRegion = (index, loop) => loop ? this.getRegion(index).playLoop() : this.getRegion(index).play();

        /**
         * @description Update region
         * @param {number} index
         * @param {RegionParams} params
         */
        this.updateRegion = (index, params) => {
            const region = this.getRegion(index);
            if (region) {
                region.update(params);
                return true;
            } else {
                return false;
            }
        };

        const zoomOnRegion = (index, options) => {
            const region = this.getRegion(index);
            if (region) {
                // Durration we want to zoom on
                const regionDuration = region.end - region.start;
                const zoomDuration = Math.max(regionDuration * 3, params.minZoomDuration);
    
                // Width of player container
                const width = wavesurfer.container.clientWidth;
    
                const pxPerSec = width / zoomDuration;
                this.zoom(pxPerSec, options);
    
                // Calculate progress where region starts
                const regionStartInPercents = region.start / wavesurfer.getDuration();
                wavesurfer.seekAndCenter(regionStartInPercents);
            }
        };

        /**
         * 
         * @param {*} time 
         * @param {*} percent 
         */
        const centerTimeAt = (time, percent) => {
            if (time === undefined || time < 0 || time > wavesurfer.getDuration()) {
                throw new Error('time out of range:', time);
            }
            if (percent === undefined || percent < 0 || percent > 1) {
                throw new Error('percent out of range:', percent);
            }

            const newPixelOffset = (percent - 0.5) * wavesurfer.container.offsetWidth;
            const timeOffset = newPixelOffset / wavesurfer.params.minPxPerSec;
            const newCenterTime = time - timeOffset;
            wavesurfer.drawer.recenter(newCenterTime / wavesurfer.getDuration());
        }

        /**
         * 
         * @param {*} pxPerSec 
         * @param {*} options 
         */
        this.zoom = (pxPerSec, options) => {
            const minZoomDuration = Math.min(params.minZoomDuration, wavesurfer.getDuration());
            const maxZoomDuration = wavesurfer.getDuration()
            const width = wavesurfer.container.offsetWidth;
            const maxPxPerSec = width / minZoomDuration;
            const minPxPerSec = width / maxZoomDuration;
            const newZoom = Math.min(Math.max(pxPerSec, minPxPerSec), maxPxPerSec);

            if (!options) {
                wavesurfer.zoom(newZoom);
                return;
            }

            let target = options.target;
            const clientX = options.clientX;
            const clientY = options.clientY;
            if (target instanceof HTMLElement && clientX !== undefined && clientY !== undefined) {
                while (true) {
                    if (target === document) {
                        console.error('implementation error, wave was not clicked');
                        return;
                    }
                    if (target.tagName === 'WAVE') {
                        break;
                    }
                    target = target.parentElement;
                }

                
                const waveElement = target;
                const scrollLeft = waveElement.scrollLeft;
                const positionInWave = util.html.coordinatesInElement(waveElement, { x: clientX, y: clientY });
                if (positionInWave.x === undefined) {
                    return;   
                }
                const offsetLeft = positionInWave.x;
                const mouseAtTime = (offsetLeft + scrollLeft) / wavesurfer.params.minPxPerSec;
                const relativePositionInWave = offsetLeft / waveElement.offsetWidth;

                wavesurfer.zoom(newZoom);
                centerTimeAt(mouseAtTime, relativePositionInWave);
            } else {
                wavesurfer.zoom(newZoom);
            }
        };

        const zoomIn = (step = 0.1, options) => {
            if (isNaN(step) || step > 1 || step < -1) {
                throw new TypeError('invalid parameter `step` - should be [-1, 1], was', step);
            }
            const width = wavesurfer.container.offsetWidth;
            const currentPxPerSec = wavesurfer.params.minPxPerSec;
            const currentZoomDuration = width / currentPxPerSec;
            const newZoomDuration = Math.max(currentZoomDuration - step * wavesurfer.getDuration(), 0);
            const newZoom = width / newZoomDuration;
            this.zoom(newZoom, options);
        };
        const zoomOut = (step = 0.1, options) => zoomIn(-step, options);

        var zoomReset = (_wavesurfer) => {
            _wavesurfer = _wavesurfer || wavesurfer;
            const width = _wavesurfer.container.clientWidth;
            const duration = this.getDuration();
            const pxPerSec = width / duration;
            this.zoom(pxPerSec);
        };
        this.zoomReset = zoomReset;

        const deactivateAllRegions = () => {
            Array.prototype.slice.call(wavesurfer.container.querySelectorAll('region.active'))
            .forEach(e => e.classList.remove('active'));
        }

        this.activateRegion = (index, event) => {
            const region = this.getRegion(index);
            if (region) {
                if (region.element.classList.contains('active')) {
                    this.isPlaying() ? this.pause() : this.playRegion(index);
                } else {
                    deactivateAllRegions();
                    region.element.classList.add('active');
                    this.pause();
                    zoomOnRegion(index, event);
                }
            } else {
                deactivateAllRegions();
                zoomReset();
            }
        };

        this.highlightRegion = index => {
            const region = this.getRegion(index);
            if (region && region.element instanceof HTMLElement) {
                region.element.classList.add('highlight');
            }
        };
        this.unhighlightRegion = index => {
            const region = this.getRegion(index);
            if (region && region.element instanceof HTMLElement) {
                region.element.classList.remove('highlight');
            }
        };

        /**
         * Rewire region events
         */
        // this.on('region-click', region => this.fireEvent('region-click', this.getRegionIndex(region), event, region)); // Handled manually
        wavesurfer.on('region-dblclick', region => this.fireEvent('region-dblclick', this.getRegionIndex(region), region));
        wavesurfer.on('region-mouseenter', (region, event) => this.fireEvent('region-mouseenter', this.getRegionIndex(region), region, event));
        wavesurfer.on('region-mouseleave', (region, event) => this.fireEvent('region-mouseleave', this.getRegionIndex(region), region, event));

        /**
         * @description Fix region range
         * @param {number} index 
         */
        const fixRegionRange = index => {
            const region = this.getRegion(index);
            const prevRegion = this.getRegion(index - 1);
            const nextRegion = this.getRegion(index + 1);
            
            if (prevRegion && region.start < prevRegion.end) {
                region.update({
                    start: prevRegion.end,
                });
            }

            if (nextRegion && region.end > nextRegion.start) {
                region.update({
                    end: nextRegion.start,
                });
            }
        };

        /**
         * Fix region range on update
         */
        wavesurfer.on('region-updated', (region => {
            const index = this.getRegionIndex(region);
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            }
            fixRegionRange(index);
            this.fireEvent('region-updated', index, region);
        }).limit(150));

        /**
         * Play region on update end
         */
        wavesurfer.on('region-update-end', (region => {
            const index = this.getRegionIndex(region);
            console.log('region-update-end', index, region)
            this.playRegion(index);
            this.fireEvent('region-update-end', index, region);
        }).debounce(150));

        /**
         * Audio control functions
         */
        this.pause = (...args) => wavesurfer.pause(...args);
        this.play = (...args) => wavesurfer.play(...args);
        this.getDuration = (...args) => wavesurfer.getDuration(...args);
        this.isPlaying = (...args) => wavesurfer.isPlaying(...args);
        this.toggleInteraction = (...args) => wavesurfer.toggleInteraction(...args);
        this.clearRegions = (...args) => clearRegions(...args);
        this.seekTo = (...args) => wavesurfer.seekTo(...args);
        this.load = (...args) => wavesurfer.load(...args);

        wavesurfer.on('ready', (...args) => this.fireEvent('ready', ...args));
        wavesurfer.on('audioprocess', (...args) => this.fireEvent('audioprocess', ...args));
        wavesurfer.on('seek', (...args) => this.fireEvent('seek', ...args));
        
        return this;
    }
}