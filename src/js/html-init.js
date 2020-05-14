import loadScript from 'load-script';

class Init {
    /**
     * Instantiate Init class and initialize elements
     *
     * This is done automatically if `window` is defined and
     * `window.TP_StopAutoInit` is not set to true
     *
     * @param {TranscriptionPlayer} TranscriptionPlayer The TranscriptionPlayer library object
     * @param {InitParams} params initialisation options
     */
    constructor(TranscriptionPlayer, params = {}) {
        console.log("@Init/constructor", TranscriptionPlayer, params)
        if (!TranscriptionPlayer) {
            throw new Error('TranscriptionPlayer is not available!');
        }

        /**
         * cache TranscriptionPlayer
         * @private
         */
        this.TranscriptionPlayer = TranscriptionPlayer;

        /**
         * build parameters, cache them in _params so minified builds are smaller
         * @private
         */
        const _params = (this.params = Object.assign(
            {},
            {
                // transcriptionPlayer parameter defaults so by default the audio player is
                // usable with native media element controls
                defaults: {},
                // containers to instantiate on, can be selector string or NodeList
                containers: 'transcription-player',
                // @TODO insert plugin CDN URIs
                pluginCdnTemplate:
                    '//localhost:8080/dist/plugin/transcriptionPlayer.[name].js',
                // loadPlugin function can be overridden to inject plugin definition
                // objects, this default function uses load-script to load a plugin
                // and pass it to a callback
                loadPlugin(name, cb) {
                    const src = _params.pluginCdnTemplate.replace(
                        '[name]',
                        name
                    );
                    loadScript(src, { async: false }, (err, plugin) => {
                        if (err) {
                            // eslint-disable-next-line no-console
                            return console.error(
                                `TranscriptionPlayer plugin ${name} not found at ${src}`
                            );
                        }
                        cb(window.TranscriptionPlayer[name]);
                    });
                }
            },
            params
        ));
        /**
         * The nodes that should have instances attached to them
         * @type {NodeList}
         */
        this.containers =
            typeof _params.containers == 'string'
                ? document.querySelectorAll(_params.containers)
                : _params.containers;
        /** @private */
        this.pluginCache = {};
        /**
         * An array of transcription-player instances
         * @type {Object[]}
         */
        this.instances = [];

        this.initAllEls();
    }

    /**
     * Initialize all container elements
     */
    initAllEls() {
        // iterate over all the container elements
        Array.prototype.forEach.call(this.containers, el => {
            // load the plugins as an array of plugin names
            const plugins = el.dataset.plugins
                ? el.dataset.plugins.split(',')
                : [];

            // no plugins to be loaded, just render
            if (!plugins.length) {
                return this.initEl(el);
            }
            // … or: iterate over all the plugins
            plugins.forEach((name, i) => {
                // plugin is not cached already, load it
                if (!this.pluginCache[name]) {
                    this.params.loadPlugin(name, lib => {
                        this.pluginCache[name] = lib;
                        // plugins were all loaded, render the element
                        if (i + 1 === plugins.length) {
                            this.initEl(el, plugins);
                        }
                    });
                } else if (i === plugins.length) {
                    // plugin was cached and this plugin was the last
                    this.initEl(el, plugins);
                }
            });
        });
    }

    /**
     * Initialize a single container element and add to `this.instances`
     *
     * @param  {HTMLElement} el The container to instantiate transcription-player to
     * @param  {PluginDefinition[]} plugins An Array of plugin names to initialize with
     * @return {Object} TranscriptionPlayer instance
     */
    initEl(el, plugins = []) {
        const jsonRegex = /^[[|{]/;
        // initialize plugins with the correct options
        const initialisedPlugins = plugins.map(plugin => {
            const options = {};
            // the regex to find this plugin attributes
            const attrNameRegex = new RegExp('^' + plugin);
            let attrName;
            // iterate over all the data attributes and find ones for this
            // plugin
            for (attrName in el.dataset) {
                const regexResult = attrNameRegex.exec(attrName);
                if (regexResult) {
                    const attr = el.dataset[attrName];
                    // if the string begins with a [ or a { parse it as JSON
                    const prop = jsonRegex.test(attr) ? JSON.parse(attr) : attr;
                    // this removes the plugin prefix and changes the first letter
                    // of the resulting string to lower case to follow the naming
                    // convention of TranscriptionPlayer params
                    const unprefixedOptionName =
                        attrName
                            .slice(plugin.length, plugin.length + 1)
                            .toLowerCase() + attrName.slice(plugin.length + 1);
                    options[unprefixedOptionName] = prop;
                }
            }
            return this.pluginCache[plugin].create(options);
        });
        // build parameter object for this container
        const params = Object.assign(
            { container: el },
            this.params.defaults,
            el.dataset,
            { plugins: initialisedPlugins }
        );

        // @TODO make nicer
        el.style.display = 'block';

        // initialize TranscriptionPlayer, load audio and transcription
        const instance = this.TranscriptionPlayer.create(params);
        instance.load(params.audioUrl, params.transcriptionUrl);

        // push this instance into the instances cache
        this.instances.push(instance);
        return instance;
    }
}

// if window object exists and window.TP_StopAutoInit is not true
if (typeof window === 'object' && !window.TP_StopAutoInit) {
    // call init when document is ready, apply any custom default settings
    // in window.TP_InitOptions
    if (document.readyState === 'complete') {
        window.TranscriptionPlayerInit = new Init(
            window.TranscriptionPlayer,
            window.TP_InitOptions
        );
    } else {
        window.addEventListener('load', () => {
            window.TranscriptionPlayerInit = new Init(
                window.TranscriptionPlayer,
                window.TP_InitOptions
            );
        });
    }
}

// export init for manual usage
export default Init;