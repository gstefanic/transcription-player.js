export default class TestPlugin {

    /**
     * @typedef {Object} MinimapPluginParams
     * @desc Extends the `WavesurferParams` wavesurfer was initialised with
     * @property {?string|HTMLElement} container CSS selector or HTML element where
     * the map should be rendered. By default it is simply appended
     * after the waveform.
     * @property {?boolean} deferInit Set to true to manually call
     * `initPlugin('minimap')`
     */

    /**
     * Test plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by transcriptionPlayer to correctly instantiate the plugin.
     *
     * @param  {TestPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    create(params) {
        return {
            name: 'test',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {},
            instance: TestPlugin
        };
    }
    
    constructor(params, ws) {}
    
    init() {}
    
    
    destroy() {}
}