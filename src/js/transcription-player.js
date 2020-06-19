import * as util from './util';
import TranscriptionComponent from './transcription-component';
// import SimplePlayer from './simple-player';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/src/plugin/regions.js';
import SimpleActionRow from './simple-action-row';
import WaveformPlayer from './waveform-player';

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
        player: WaveformPlayer,
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
            this.player.scrollZoomEnabled = true;
            this.player.pause();
            this.transcription.startEditing();
        });

        const highlight = index => {
            this.player.highlightRegion(index);
            this.transcription.highlightSection(index);
        };
        const unhighlight = index => {
            if (index === undefined) {
                // Remove all `highlight` classes from regions and sections
                Array.prototype.slice.call(this.container.querySelectorAll('.selected.highlight, region.highlight'))
                .forEach(e => e.classList.remove('highlight'));
            } else {
                this.player.unhighlightRegion(index);
                this.transcription.unhighlightSection(index);
            }
        };

        this.player.on('region-mouseenter', highlight);
        this.player.on('region-mouseleave', unhighlight);
        this.transcription.on('section-mouseenter', highlight);
        this.transcription.on('section-mouseleave', unhighlight);

        const activate = (index, event) => {
            this.player.activateRegion(index);
            this.transcription.activateSection(index);
        };

        this.player.on('region-click', activate);
        this.transcription.on('section-click', activate);

        this.transcription.on('section-created', ({start, end, index}) => {
            if (start === undefined || end === undefined) {

                if (index === undefined) {
                    throw new Error('`section-created` should emit at least one of `start`, `end` or `index`')
                }
                
                // New section has been created by hand
                // create new region
                console.log('TODO: create new region', index);
                const leftRegion = this.player.getRegion(index - 1);
                const rightRegion = this.player.getRegion(index);

                start = leftRegion ? leftRegion.end : 0;
                end = rightRegion ? rightRegion.start : this.player.getDuration();
            }

            const {region} = this.player.addRegion({
                start: start,
                end: end,
            });

            if (region) {
                activate(index);
            } else if (index !== undefined) {
                // TODO show error because there is no room for new region
                this.transcription.removeSection(index);
            }
            
        });

        this.transcription.on('section-removed', index => {
            console.log('section-removed', index);
            this.player.pause();
            this.player.removeRegion(index);
        });

        cancelButton.on('click', () => {
            console.log('cancelClicked');
            this.player.pause();
            this.player.zoomReset();
            this.transcription.doneEditing();
            this.player.toggleInteraction();
            this.player.scrollZoomEnabled = false;
            this.player.clearRegions();
            this.actionsRow.layout = undefined;
        });

        doneButton.on('click', () => {
            console.log('doneClicked');
            this.player.pause();
            this.player.zoomReset();
            // console.log('regions:', Object.keys(this.player.regions.list), this.player.regions.list);
            // const regions = Object.keys(this.player.regions.list).map((_, index) => {
            //     const region = getRegionFromId(regionIdFromIndex(index));
            //     return {
            //         start: region.start,
            //         end: region.end,
            //     }
            // });
            const regions = this.player.getRegions();
            this.transcription.doneEditing(regions);
            this.player.toggleInteraction();
            this.player.scrollZoomEnabled = false;
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

        var params = Object.assign({
            container: container,
        });

        this.player = this.Player.create(params);

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