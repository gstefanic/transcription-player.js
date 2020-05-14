import * as util from './util';
import TranscriptionComponent from './transcription-component';
// import SimplePlayer from './simple-player';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/src/plugin/regions.js';
import SimpleActionRow from './simple-action-row';
import { is } from 'date-fns/locale';

/**
 * @typedef {Object} PluginDefinition
 * @desc The Object used to describe a plugin
 * @example wavesurfer.addPlugin(pluginDefinition);
 * @property {string} name The name of the plugin, the plugin instance will be
 * added as a property to the wavesurfer instance under this name
 * @property {?Object} staticProps The properties that should be added to the
 * wavesurfer instance as static properties
 * @property {?boolean} deferInit Don't initialise plugin
 * automatically
 * @property {Object} params={} The plugin parameters, they are the first parameter
 * passed to the plugin class constructor function
 * @property {PluginClass} instance The plugin instance factory, is called with
 * the dependency specified in extends. Returns the plugin class.
 */

/**
 * @interface PluginClass
 *
 * @desc This is the interface which is implemented by all plugin classes. Note
 * that this only turns into an observer after being passed through
 * `wavesurfer.addPlugin`.
 *
 * @extends {Observer}
 */
class PluginClass {
    /**
     * Plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * It returns a `PluginDefinition` object representing the plugin.
     *
     * @param {Object} params={} The plugin params (specific to the plugin)
     */
    create(params) {}
    /**
     * Construct the plugin
     *
     * @param {Object} params={} The plugin params (specific to the plugin)
     * @param {Object} ws The wavesurfer instance
     */
    constructor(params, ws) {}
    /**
     * Initialise the plugin
     *
     * Start doing something. This is called by
     * `wavesurfer.initPlugin(pluginName)`
     */
    init() {}
    /**
     * Destroy the plugin instance
     *
     * Stop doing something. This is called by
     * `wavesurfer.destroyPlugin(pluginName)`
     */
    destroy() {}
}

export default class TranscriptionPlayer extends util.Observer {

    defaultParams = {
        container: null,
        player: WaveSurfer,
        transcription: TranscriptionComponent,
        actionsRow: SimpleActionRow,
    };

    /**
     * Instantiate this class, call its `init` function and returns it
     *
     * @param {TranscriptionPlayerParams} params The transcriptionPlayer parameters
     * @return {Object} TranscriptionPlayer instance
     * @example const transcriptionPlayer = TranscriptionPlayer.create(params);
     */
    static create(params) {
        console.log("@TranscriptionPlayer/create", params);
        const transcriptionPlayer = new TranscriptionPlayer(params);
        return transcriptionPlayer.init();
    }

    /**
     * The library version number is available as a static property of the
     * TranscriptionPlayer class
     *
     * @type {String}
     * @example
     * console.log('Using transcriptionPlayer.js ' + TranscriptionPlayer.VERSION);
     */
    static VERSION = __VERSION__;

    /**
     * Functions in the `util` property are available as a prototype property to
     * all instances
     *
     * @type {Object}
     * @example
     * const transcriptionPlayer = TranscriptionPlayer.create(params);
     * transcriptionPlayer.util.style(myElement, { background: 'blue' });
     */
    util = util;

    /**
     * Functions in the `util` property are available as a static property of the
     * TranscriptionPlayer class
     *
     * @type {Object}
     * @example
     * TranscriptionPlayer.util.style(myElement, { background: 'blue' });
     */
    static util = util;

    /**
     * Initialise transcriptionPlayer instance
     *
     * @param {TranscriptionPlayer} params Instantiation options for transcriptionPlayer
     * @example
     * const transcriptionPlayer = new TranscriptionPlayer(params);
     * @returns {this} TranscriptionPlayer instance
     */
    constructor(params) {
        super();
        console.log("@TranscriptionPlayer/constructor", params);

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);
        
        /** 
         * @type {HTMLElement}
         * @private 
         * */
        this.container =
        'string' == typeof params.container
        ? document.querySelector(this.params.container)
        : this.params.container;
        
        if (!this.container) {
            throw new Error('Container element not found');
        }

        this.playerContainer = null;
        this.transcriptionContainer = null;
        this.actionsRowContainer = null;
        
        this.player = null;
        this.transcription = null;
        this.actionsRow = null;

        this.Player = this.params.player;
        this.Transcription = this.params.transcription;
        this.ActionsRow = this.params.actionsRow;

        /**
         * Get the current ready status.
         *
         * @example const isReady = transcriptionPlayer.isReady;
         * @return {boolean}
         */
        this.isReady = false;
        
        return this;
    }

    /**
     * Initialise
     *
     * @example
     * var transcriptionPlayer = new TranscriptionPlayer(params);
     * transcriptionPlayer.init();
     * @return {this} The transcriptionPlayer instance
     */
    init() {
        console.log("@TranscriptionPlayer/init");
        this.registerPlugins(this.params.plugins);
        
        require('../css/transcription-player.css');
        this.container.innerHTML = require('../html/transcription-player.html')();
        this.playerContainer = this.container.querySelector('.tp-player-container');
        this.transcriptionContainer = this.container.querySelector('.tp-transcription-container');
        this.actionsRowContainer = this.container.querySelector('.tp-actions-container');

        this.createPlayer(this.playerContainer);
        this.createTranscription(this.transcriptionContainer);
        this.createActionsRow(this.actionsRowContainer);
        
        const lyricsModeToggle = this.actionsRow.addToggle({
            name: 'toggle-view-mode',
            text: 'Lyrics Mode',
            bind: {
                context: this.transcription,
                prop: 'isLyricsMode',
            },
        });
        
        const editButton = this.actionsRow.addButton({
            name: 'button-edit',
            text: 'Edit',
            style: 'primary',
        });
        
        const cancelButton = this.actionsRow.addButton({
            name: 'button-cancel',
            layout: 'editing',
            text: 'Cancel',
            style: 'danger',
        });

        const doneButton = this.actionsRow.addButton({
            name: 'button-done',
            layout: 'editing',
            text: 'Done',
            style: 'success',
        });

        editButton.on('click', () => {
            console.log('editClicked');
            this.actionsRow.layout = 'editing';
            lyricsModeToggle.enabled = false;
            this.player.toggleInteraction();
            this.player.pause();
            this.transcription.startEditing();
        });

        const calculateSectionIndex = section => {
            if (section) {
                return Array.prototype.slice.call(section.parentElement.querySelectorAll('.selected')).findIndex(el => el === section);
            }
        };

        const getRegionFromId = id => this.player.regions.list[id];
        let _regionIndexIdMap = [];
        let _allRegionsCount = 0;
        const regionIdFromIndex = index => index < _regionIndexIdMap.length ? _regionIndexIdMap[index] : undefined;
        const regionIndexFromId = id => {
            const index = _regionIndexIdMap.findIndex(_id => _id === id);
            return index >= 0 ? index : undefined;
        };
        const getNextRegion = (regionOrId, fn = index => index + 1) => {
            if (isRegion(regionOrId)) {
                const region = regionOrId;
                return getNextRegion(region.id, fn);
            } else if (isValidRegionId(regionOrId)) {
                const id = regionOrId;
                const index = regionIndexFromId(id);
                const nextIndex = fn(index);
                const nextRegionId = regionIdFromIndex(nextIndex);
                return getRegionFromId(nextRegionId);
            } else {
                return undefined;
            }
        };
        const getPreviousRegion = (regionOrId, fn = index => index - 1) => getNextRegion(regionOrId, fn);

        let _zoomedRegionId = undefined;
        /**
         * @param {string} id 
         */
        const isZoomedInOnRegion = regionOrId => {
            if (isRegion(regionOrId)) {
                const region = regionOrId;
                return isZoomedInOnRegion(region.id);
            } else if (isValidRegionId(regionOrId)) {
                const id = regionOrId;
                return _zoomedRegionId !== undefined && id === _zoomedRegionId;
            } else {
                return false;
            }
        };

        /**
         * @param {string} id 
         */
        const isValidRegionId = id => this.player.regions.list[id] !== undefined;

        const isRegion = region => region !== undefined && region.play && region.id !== undefined;

        /**
         * @param {string} id
         */
        const zoomOnRegion = (regionOrId, minZoomDuration = 24) => {
            if (isValidRegionId(regionOrId)) {
                const id = regionOrId;
                return zoomOnRegion(getRegionFromId(id));
            } else if (isRegion(regionOrId)) {
                const region = regionOrId;
                if (region) {
                    // Durration we want to zoom on
                    const duration = region.end - region.start;
                    const zoomDuration = Math.max(duration * 3, minZoomDuration);
        
                    // Width of player container
                    const width = this.player.container.clientWidth;
        
                    const pxPerSec = width / zoomDuration;
                    this.player.zoom(pxPerSec);
        
                    // Calculate progress where region starts
                    const regionStartInPercents = region.start / this.player.getDuration();
                    this.player.seekAndCenter(regionStartInPercents);
    
                    // Change previous active region `background-color`
                    // if (isValidRegionId(_zoomedRegionId)) {
                    //     deactivate(regionIndexFromId(_zoomedRegionId));
                    // }
    
                    activate(regionIndexFromId(region.id));
    
                    _zoomedRegionId = region.id;
                    return true;
                }
            }
            return false;
        };

        const zoomOut = () => {
            const width = this.player.container.clientWidth;
            const duration = this.player.getDuration();
            const pxPerSec = width / duration;
            this.player.zoom(pxPerSec);

            // Change color of active region to default
            if (isValidRegionId(_zoomedRegionId)) {
                deactivate(regionIndexFromId(_zoomedRegionId))
            }

            _zoomedRegionId = undefined;
        };

        const activateSection = section => section instanceof HTMLElement && section.classList.add('active');
        const deactivateSection = section => section instanceof HTMLElement && section.classList.remove('active');

        const activateRegion = region => isRegion(region) && region.element instanceof HTMLElement && region.element.classList.add('active');
        const deactivateRegion = region => isRegion(region) && region.element instanceof HTMLElement && region.element.classList.remove('active');

        const activate = index => {
            deactivate();
            const section = getSectionFromIndex(index);
            activateSection(section);

            const regionId = regionIdFromIndex(index);
            const region = getRegionFromId(regionId);
            activateRegion(region);
        };

        const deactivate = index => {
            if (index === undefined) {
                Array.prototype.slice.call(this.container.getElementsByClassName('active')).forEach(e => e.classList.remove('active'));
            } else {
                const section = getSectionFromIndex(index);
                deactivateSection(section);
    
                const regionId = regionIdFromIndex(index);
                const region = getRegionFromId(regionId);
                deactivateRegion(region);
            }
        };

        /**
         * @param {string} id Region id
         * @param {boolean} loop Whether to loop region
         */
        const playRegion = (regionOrId, loop = false) => {
            if (isRegion(regionOrId)) {
                const region = regionOrId;
                if (region) {
                    loop ? region.playLoop() : region.play();
                }
            } else if (isValidRegionId(regionOrId)) {
                const id = regionOrId;
                playRegion(getRegionFromId(id));
            }
        };

        this.transcription.on('section-click', section => {
            console.log('section-click', section);

            const index = calculateSectionIndex(section);
            const regionId = regionIdFromIndex(index);

            if (isValidRegionId(regionId)) {
                if (isZoomedInOnRegion(regionId)) {
                    this.player.isPlaying() ? this.player.pause() : playRegion(regionId);
                } else {
                    this.player.pause();
                    zoomOnRegion(regionId);
                }
            } else {
                zoomOut();
            }
        });

        this.player.on('region-click', region => {
            if (isZoomedInOnRegion(region)) {
                this.player.isPlaying() ? this.player.pause() : playRegion(region);
            } else {
                this.player.pause();
                zoomOnRegion(region);
            }
        });

        /*  */
        this.player.on('region-dblclick', region => {
            console.log('region-dblclick', region);
            const index = regionIndexFromId(region.id);
            removeSection(getSectionFromIndex(index));
            region.remove();
            zoomOut();
        });

        /**
         * @param {HTMLElement} section 
         */
        const removeSection = section => {
            if (section instanceof HTMLElement) {
                while (section.firstChild) {
                    if (section.firstChild.classList.contains('handle')) {
                        section.firstChild.remove();
                    } else {
                        section.insertAdjacentElement('beforebegin', section.firstChild);
                    }
                }
                section.remove();
            }
        }

        const addRegion = (index, {start, end}) => {
            if (start !== undefined && end !== undefined && start < end && start >= 0 && end <= this.player.getDuration()) {
                const regionId = _allRegionsCount++;
                this.player.addRegion({
                    id: regionId,
                    start: start,
                    end: end,
                    drag: false,
                });
                _regionIndexIdMap.splice(index, 0, regionId);
                return regionId;
            }
        };

        const removeRegion = index => {
            const regionId = regionIdFromIndex(index);
            const region = getRegionFromId(regionId);
            if (isRegion(region)) {
                region.remove();
            }
        };

        this.player.on('region-removed', region => {
            if (isRegion(region)) {
                const regionId = region.id;
                const index = regionIndexFromId(regionId);
                if (index !== undefined && index >= 0 && index < _regionIndexIdMap.length) {
                    _regionIndexIdMap.splice(index, 1);
                }
            }
        });

        this.transcription.on('section-created', ({section, start, end, init}) => {
            console.log('section-created', section, start, end, init);

            const index = calculateSectionIndex(section);

            if (start !== undefined && end !== undefined && index !== undefined) {
                addRegion(index, {
                    start: start,
                    end: end,
                });
            } else if (!init && section) {
                // New section has been created by hand
                // create new region
                console.log('TODO: create new region and fix ids');
                const leftRegion = getRegionFromId(regionIdFromIndex(index - 1));
                const rightRegion = getRegionFromId(regionIdFromIndex(index));

                const leftBorder = leftRegion ? leftRegion.end : 0;
                const rightBorder = rightRegion ? rightRegion.start : this.player.getDuration();

                console.log(leftBorder, rightBorder);

                if (leftBorder < rightBorder) {
                    const regionId = addRegion(index, {
                        start: leftBorder,
                        end: rightBorder,
                    });

                    unhighlight();
                    zoomOnRegion(regionId);
                } else {
                    // TODO show error because there is no room for new region
                    removeSection(section);
                }

            }

            const mouseHoverHandler = event => {
                this.transcription.fireEvent('section-' + event.type, {
                    target: section,
                    oe: event,
                    index: calculateSectionIndex(section),
                });
            };

            if (section instanceof HTMLElement) {
                section.addEventListener('mouseenter', mouseHoverHandler);
                section.addEventListener('mouseleave', mouseHoverHandler);
            }
        });

        this.transcription.on('section-removed', index => {
            console.log('section-removed', index);
            removeRegion(index);
            if (!zoomOnRegion(index + 1)) {
                if (!zoomOnRegion(index)) {
                    zoomOut();
                }
            }
        });

        const getSectionFromIndex = index => Array.prototype.slice.call(this.transcription.container.querySelectorAll('.selected'))[index];

        const highlightSection = section => section && section instanceof HTMLElement && section.classList.add('highlight');
        const unhighlightSection = section => section && section instanceof HTMLElement && section.classList.remove('highlight');;

        const highlightRegion = region => isRegion(region) && region.element instanceof HTMLElement && region.element.classList.add('highlight');

        const unhighlightRegion = region => isRegion(region) && region.element instanceof HTMLElement && region.element.classList.remove('highlight');

        const highlight = index => {
            const section = getSectionFromIndex(index);
            // console.log('hightlight section:', section, index);
            highlightSection(section);

            const regionId = regionIdFromIndex(index);
            const region = getRegionFromId(regionId);
            highlightRegion(region);
        };

        const unhighlight = index => {
            if (index === undefined) {
                Array.prototype.slice.call(this.container.getElementsByClassName('highlight')).forEach(e => e.classList.remove('highlight'));
            } else {
                const section = getSectionFromIndex(index);
                unhighlightSection(section);
    
                const regionId = regionIdFromIndex(index);
                const region = getRegionFromId(regionId);
                unhighlightRegion(region);
            }
        };

        this.transcription.on('section-mouseenter', ({index, oe, target}) => {
            // console.log('section-mouseenter', index, target);
            highlight(index);
        });

        this.transcription.on('section-mouseleave', ({index, oe, target}) => {
            // console.log('section-mouseleave', index, target);
            unhighlight(index);
        });

        this.player.on('region-mouseenter', (region, event) => {
            console.log('region-mouseenter', region, event);
            highlight(regionIndexFromId(region.id));
        });
        
        this.player.on('region-mouseleave', (region, event) => {
            // console.log('region-mouseleave', region, event);
            unhighlight(regionIndexFromId(region.id));
        });
        
        const fixRegionRange = region => {
            const prevRegion = getPreviousRegion(region);
            const nextRegion = getNextRegion(region);
            
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

        const throttledFixRegionRange = fixRegionRange.throttle(150);
        const debouncedFixRegionRange = fixRegionRange.debounce(150);

        this.player.on('region-updated', region => {
            if (this.player.isPlaying) {
                this.player.pause();
            }
            throttledFixRegionRange(region);
            debouncedFixRegionRange(region);
        });

        this.player.on('region-update-end', region => {
            playRegion(region);
        });

        cancelButton.on('click', () => {
            console.log('cancelClicked');
            this.player.pause();
            this.transcription.doneEditing();
            this.player.toggleInteraction();
            this.player.clearRegions();
            this.actionsRow.layout = undefined;
        });

        doneButton.on('click', () => {
            console.log('doneClicked');
            this.player.pause();
            console.log('regions:', Object.keys(this.player.regions.list), this.player.regions.list);
            const regions = Object.keys(this.player.regions.list).map((_, index) => {
                const region = getRegionFromId(regionIdFromIndex(index));
                return {
                    start: region.start,
                    end: region.end,
                }
            });
            this.transcription.doneEditing(regions);
            this.player.toggleInteraction();
            this.player.clearRegions();
            this.actionsRow.layout = null;
        });

        this.on('timeupdated', time => this.transcription.onTimeUpdated(time));

        this.on('seek', progress => this.transcription.onTimeUpdated(progress * this.player.getDuration()));

        this.transcription.on('goto', time => this.player.seekTo(time / this.player.getDuration()));

        return this;
    }

    /**
     * Add and initialise array of plugins (if `plugin.deferInit` is falsey),
     * this function is called in the init function of transcriptionPlayer
     *
     * @param {PluginDefinition[]} plugins An array of plugin definitions
     * @emits {TranscriptionPlayer#plugins-registered} Called with the array of plugin definitions
     * @return {this} The transcriptionPlayer instance
     */
    registerPlugins(plugins) {
        // first instantiate all the plugins
        plugins.forEach(plugin => this.addPlugin(plugin));

        // now run the init functions
        plugins.forEach(plugin => {
            // call init function of the plugin if deferInit is falsey
            // in that case you would manually use initPlugins()
            if (!plugin.deferInit) {
                this.initPlugin(plugin.name);
            }
        });
        this.fireEvent('plugins-registered', plugins);
        return this;
    }

    /**
     * Get a map of plugin names that are currently initialised
     *
     * @example transcriptionPlayer.getPlugins();
     * @return {Object} Object with plugin names
     */
    getActivePlugins() {
        return this.initialisedPluginList;
    }

    /**
     * Add a plugin object to transcriptionPlayer
     *
     * @param {PluginDefinition} plugin A plugin definition
     * @emits {TranscriptionPlayer#plugin-added} Called with the name of the plugin that was added
     * @example transcriptionPlayer.addPlugin(TranscriptionPlayer.test());
     * @return {this} The transcriptionPlayer instance
     */
    addPlugin(plugin) {
        if (!plugin.name) {
            throw new Error('Plugin does not have a name!');
        }
        if (!plugin.instance) {
            throw new Error(
                `Plugin ${plugin.name} does not have an instance property!`
            );
        }

        // staticProps properties are applied to wavesurfer instance
        if (plugin.staticProps) {
            Object.keys(plugin.staticProps).forEach(pluginStaticProp => {
                /**
                 * Properties defined in a plugin definition's `staticProps` property are added as
                 * staticProps properties of the TranscriptionPlayer instance
                 */
                this[pluginStaticProp] = plugin.staticProps[pluginStaticProp];
            });
        }

        const Instance = plugin.instance;

        // turn the plugin instance into an observer
        const observerPrototypeKeys = Object.getOwnPropertyNames(
            util.Observer.prototype
        );
        observerPrototypeKeys.forEach(key => {
            Instance.prototype[key] = util.Observer.prototype[key];
        });

        /**
         * Instantiated plugin classes are added as a property of the transcriptionPlayer
         * instance
         * @type {Object}
         */
        this[plugin.name] = new Instance(plugin.params || {}, this);
        this.fireEvent('plugin-added', plugin.name);
        return this;
    }

    /**
     * Initialise a plugin
     *
     * @param {string} name A plugin name
     * @emits TranscriptionPlayer#plugin-initialised
     * @example transcriptionPlayer.initPlugin('test');
     * @return {this} The transcriptionPlayer instance
     */
    initPlugin(name) {
        if (!this[name]) {
            throw new Error(`Plugin ${name} has not been added yet!`);
        }
        if (this.initialisedPluginList[name]) {
            // destroy any already initialised plugins
            this.destroyPlugin(name);
        }
        this[name].init();
        this.initialisedPluginList[name] = true;
        this.fireEvent('plugin-initialised', name);
        return this;
    }

    /**
     * Destroy a plugin
     *
     * @param {string} name A plugin name
     * @emits TranscriptionPlayer#plugin-destroyed
     * @example transcriptionPlayer.destroyPlugin('test');
     * @returns {this} The transcriptionPlayer instance
     */
    destroyPlugin(name) {
        if (!this[name]) {
            throw new Error(
                `Plugin ${name} has not been added yet and cannot be destroyed!`
            );
        }
        if (!this.initialisedPluginList[name]) {
            throw new Error(
                `Plugin ${name} is not active and cannot be destroyed!`
            );
        }
        if (typeof this[name].destroy !== 'function') {
            throw new Error(`Plugin ${name} does not have a destroy function!`);
        }

        this[name].destroy();
        delete this.initialisedPluginList[name];
        this.fireEvent('plugin-destroyed', name);
        return this;
    }

    /**
     * Destroy all initialised plugins. Convenience function to use when
     * transcriptionPlayer is removed
     *
     * @private
     */
    destroyAllPlugins() {
        Object.keys(this.initialisedPluginList).forEach(name =>
            this.destroyPlugin(name)
        );
    }

    /**
     * Create the player component
     *
     * @private
     * @emits TranscriptionPlayer#player-created
     */
    createPlayer(container) {
        const roundedBarsParams = {
            waveColor: '#D9DCFF',
            progressColor: '#4353FF',
            cursorColor: '#4353FF',
            barWidth: 3,
            barRadius: 3,
            cursorWidth: 1,
            // height: 100,
            barGap: 3,
        }
        var params = Object.assign({
            container: container,
            backend: 'MediaElement',
            mediaControls: true,
            fillParent: true,
            scrollParent: false,
        }, roundedBarsParams);

        this.player = this.Player.create(params);

        this.player.addPlugin(RegionsPlugin.create());

        const forceHorizontalScroll = container => {
            function scrollHorizontally(e) {
                e = window.event || e;
                var delta = Math.max(-1, Math.min(1, (e.deltaY || e.wheelDelta || -e.detail)));
                console.log('wheel', delta, e);
                container.scrollLeft += (delta * 40); // Multiplied by 40
                e.preventDefault();
            }
            if (container.addEventListener) {
                container.addEventListener("wheel", scrollHorizontally, false);
            } else {
                // IE 6/7/8
                container.attachEvent("onmousewheel", scrollHorizontally);
            }
        };

        forceHorizontalScroll(this.player.container.querySelector('wave'));

        this.player.on('ready', () => this.fireEvent('player-created'));
        this.player.on('audioprocess', time => this.fireEvent('timeupdated', time));
        this.player.on('seek', progress => this.fireEvent('seek', progress));

        this.fireEvent('player-created', this.player);
        return this.player;
    }

    /**
     * Create the transcription component
     *
     * @private
     * @emits TranscriptionPlayer#transcription-created
     */
    createTranscription(container) {
        this.transcription = this.Transcription.create(container, this.params);
        this.fireEvent('transcription-created');
        return this.transcription;
    }

    /**
     * Create the actions row
     *
     * @private
     * @emits TranscriptionPlayer#actions-row-created
     */
    createActionsRow(container) {
        this.actionsRow = this.ActionsRow.create(container, this.params);
        this.fireEvent('actions-row-created', this.actionsRow);
        return this.actionsRow;
    }

    /**
     * Loads audio and transcription and re-renders the UI.
     *
     * @param {string|HTMLMediaElement} audioUrl The url of the audio file or the
     * audio element with the audio
     * @param {string|JSON} transcriptionUrl The url of the transcription file or the
     * JSON file with transcription
     * @returns {void}
     * @throws Will throw an error if the `audioUrl` or `transcriptionUrl` arguments are empty.
     * @example
     * // uses fetch or media element to load file (depending on backend)
     * transcriptionPlayer.load('http://example.com/demo.wav', 'http://example.com/demo.json');
     */
    load(audioUrl, transcriptionUrl) {
        console.log("@TranscriptionPlayer/load", audioUrl, transcriptionUrl);
        if (!audioUrl || !transcriptionUrl) {
            throw new Error('audioUrl parameter cannot be empty');
        }
        if (!transcriptionUrl) {
            throw new Error('transcriptionUrl parameter cannot be empty');
        }

        this.empty();

        var preload = true;
        
        // check whether the preload attribute will be usable and if not log
        // a warning listing the reasons why not and nullify the variable
        const preloadIgnoreReasons = {
            'audioUrl is not of type string': typeof audioUrl !== 'string',
            'transcriptionUrl is not of type string': typeof transcriptionUrl !== 'string'
        };
        const activeReasons = Object.keys(preloadIgnoreReasons).filter(
            reason => preloadIgnoreReasons[reason]
        );
        if (activeReasons.length) {
            // eslint-disable-next-line no-console
            console.error(
                'Content will not be preloaded because:\n\t- ' +
                    activeReasons.join('\n\t- ')
            );
            // stop invalid values from being used
            preload = null;
        }

        this.player.load(audioUrl);

        return
    }

    /**
     * Display empty transcriptionPlayer.
     */
    empty() {
        console.log("@TranscriptionPlayer/empty");
    }
}