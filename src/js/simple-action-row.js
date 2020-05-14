import * as util from './util';
import { isThisMinute, isThisSecond } from 'date-fns';
import cssModify from "css-modify";

const TOGGLE = 'toggle';
const BUTTON = 'button';

export default class SimpleActionRow extends util.Observer {

    defaultParams = {
        actionRowHeight: '20px',
        layout: 'main',
    };

    types = {
        [TOGGLE]: SimpleToggle,
        [BUTTON]: SimpleButton,
    }

    static create(container, params) {
        var simpleActionRow = new SimpleActionRow(container, params);
        return simpleActionRow.init();
    }

    constructor(container, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);

        /** @private */
        this.container = container;
        this.actions = null;
        this.activeLayout = this.params.layout;
        this.layouts = {};

        return this;
    }

    init() {
        require('../css/simple-action-row.css');
        this.container.classList.add('tp-ar-container');
        this.container.innerHTML = require('../html/simple-action-row.html')();
        this.actions = {};
        return this;
    }

    destroy() {

    }

    /**
     * @public
     * @param {string} layoutName Name of layout (must be unique)
     * @param {boolean} [activate = false] Whether to activate layout immediately
     * @returns {boolean} Whether layout has been created
     */
    createLayout(layoutName, activate = false) {
        if (layoutName in this.layouts) {
            return false;
        }
        this.layouts[layoutName] = {};
        if (activate) {
            this.layout = layoutName;
        }
        return true;
    }

    /**
     * @public
     * @param {string} layoutName Name of the layout to remove 
     * @param {boolean} [destroyActions = false] Whether to destory actions in this layout
     * @returns {boolean} Whether layout has been removed
     */
    removeLayout(layoutName, destroyActions = false) {
        if (layoutName in this.layouts) {
            if (this.activeLayout = layoutName) {
                this.activateLayout(this.defaultParams.layout);
            }
            if (destroyActions) {
                Object.keys(this.layouts[layoutName]).forEach(
                    actionName => {
                        delete this.layouts[layoutName][actionName];
                        this.removeAction(actionName);
                    }
                );
            }
            if (layoutName !== this.defaultParams.layout) {
                delete this.layouts[layoutName];
            }
        }
        return true;
    }

    /**
     * @public Adds action (that is already in this.actions) to layout
     * @param {string|Action} nameOrAction Action name or Action object (from this.types)
     * @param {string} layoutName Name of the layout to add action to 
     * @param {boolean} [create = false] Whether to create layout if it does not exits
     * @returns {boolean} Whether action has been added to layout
     */
    addToLayout(nameOrAction, layoutName, create = false) {
        if (typeof nameOrAction === 'string' && this.getActionByName(nameOrAction)) {
            var actionName = nameOrAction;
        } else if (this.isActionObject(nameOrAction)) {
            actionName = nameOrAction.name;
            var action = this.getActionByName(actionName);
            if (!action) {
                // is action but is not in this.actions
                return false;
                // this.insertAction(actionName, nameOrAction);
                // // TODO set action visible or not
                // if (this.isInLayout(params.name, this.activeLayout)) {
                //     action.visible = params.visible !== false;
                // }
            } else if (action !== nameOrAction) {
                return false;
            }
        }

        if (actionName) {
            if (create) {
                this.createLayout(layoutName);
            }

            if (this.isLayout(layoutName)) {
                this.layouts[layoutName][actionName] = true;
                return true;
            }
        }

        return false;
    }

    /**
     * @public
     * @param {string|Action} nameOrAction 
     * @param {string} layoutName 
     * @param {boolean} [destroy = false] 
     * @returns {boolean} Whether action was successfully removed
     */
    removeFromLayout(nameOrAction, layoutName, destroy = false) {
        if (this.isInLayout(nameOrAction, layoutName)) {
            if (destroy) {
                this.removeAction(nameOrAction);
            } else {
                if (typeof nameOrAction === 'string') {
                    delete this.layouts[layoutName][nameOrAction];
                } else {
                    delete this.layouts[layoutName][nameOrAction.name];
                }
            }
            return true;
        }
        return false;
    }

    /**
     * @public
     * @param {string|Action} nameOrAction Action to check if is in layout
     * @param {string} layoutName Name of layout to check in
     * @returns {boolean} Whether action is in layout
     */
    isInLayout(nameOrAction, layoutName) {
        if (typeof nameOrAction === 'string' && this.getActionByName(nameOrAction)) {
            var actionName = nameOrAction;
        } else if (this.isActionObject(nameOrAction)) {
            actionName = nameOrAction.name;
            var action = this.getActionByName(actionName);
            if (action !== nameOrAction) {
                return false;
            }
        }

        if (this.isLayout(layoutName)) {
            return Object.keys(this.layouts[layoutName]).find(
                name => actionName === name
            ) !== undefined;
        }
        return false;
    }

    /**
     * @public
     * @param {string} layoutName 
     */
    activateLayout(layoutName) {
        if (!layoutName || layoutName === '') {
            layoutName = this.defaultParams.layout;
        }
        if (this.activeLayout !== layoutName && this.isLayout(layoutName)) {

            // hide all actions from current layout
            Object.keys(this.layouts[this.activeLayout]).forEach(
                actionName => this.getActionByName(actionName).visible = false
            );

            // enable all actions in new layout
            Object.keys(this.layouts[layoutName]).forEach(
                actionName => this.getActionByName(actionName).visible = true
            );

            this.activeLayout = layoutName;
        }
    }

    set layout(layoutName) {
        this.activateLayout(layoutName);
    }

    get layout() {
        return this.activeLayout;
    }

    /**
     * @public
     * @param {Object} action Object to check if is Action object
     * @retruns {boolean} Whether object is Action object
     */
    isActionObject(action) {
        return Object.keys(this.types).find(type => action instanceof this.types[type]) !== undefined;
    }

    /**
     * @public
     * @param {string} layoutName Layout name
     * @returns {booalean} Whether layout with this name already exists
     */
    isLayout(layoutName) {
        return this.layouts.hasOwnProperty(layoutName);
    }

    /**
     * @public
     * @param {string} actionName Name of action to get
     * @returns {Action|undefined} Action or undefined
     */
    getActionByName(actionName) {
        return this.actions[actionName];
    }

    /**
     * @private
     */
    insertAction(name, action, position = 'end') {
        if (name in this.actions) {
            // action.destroy();
            return this.actions[name];
        } else if (typeof name === 'string' && action && action.element instanceof HTMLElement) {
            this.actions[name] = action;
            if (position === 'end') {
                this.container.appendChild(action.element);
            } else {
                this.container.insertBefore(action.element, this.container.childNodes[0]);
            }
            action.on('destroy', action => this.removeAction(action));
            return action;
        } else if (action && action.destroy) {
            action.destroy();
            return null;
        }
    }

    /**
     * @private
     * @param {*} nameOrAction
     */
    removeAction(nameOrAction) {
        if (typeof nameOrAction === 'string') {
            // remove action from all layouts
            Object.keys(this.layouts).forEach(
                layout => this.removeFromLayout(nameOrAction, layout)
            );

            var action = this.actions[nameOrAction]
            delete this.actions[nameOrAction];
            action.destroy();
        } else {
            var name = Object.keys(this.actions).find(
                name => this.actions[name] === nameOrAction
            );
            name && this.removeAction(name);
        }
    }

    /**
     * @public
     * @param {*} type 
     * @param {*} params 
     */
    addAction(type, params) {
        console.log('@SimpleActionRow/addAction', type, params);
        if (params.name in this.actions) {
            console.log('params.name already in this.actions')
            return this.actions[params.name];
        }
        if (type in this.types) {
            params.height = this.params.actionRowHeight;
            var action = new this.types[type].create(params);
            this.defineCommonActionProperties(action);
            action.fireEvent('create', action);
            // add action to layouts
            action.visible = false;
            var ac = this.insertAction(params.name, action, params.position);
            if (ac === action) {
                if (params.layout) {
                    if (params.layout.constructor === Array) {
                        params.layout.forEach(
                            layoutName => this.addToLayout(action, layoutName, true)
                        );
                    } else {
                        this.addToLayout(action, params.layout, true);
                    }
                } else {
                    this.addToLayout(action, this.defaultParams.layout, true);
                }
            }
            // TODO set action visible or not
            if (this.isInLayout(params.name, this.activeLayout)) {
                action.visible = params.visible !== false;
            }
            return ac;
        } else {
            console.log('type not in this.types', type, this.types);
            return null;
        }
    }

    addToggle(params) {
        console.log('@SimpleActionRow/addToggle', params);
        return this.addAction(TOGGLE, params);
    }

    addButton(params) {
        console.log('@SimpleActionRow/addButton', params);
        return this.addAction(BUTTON, params);
    }

    defineCommonActionProperties(action) {
        (() => {
            Object.defineProperty(action, 'visible', {
                set(visible) {
                    if (action.element instanceof HTMLElement) {
                        if (visible === false) {
                            action.element.classList.add('hidden');
                        } else {
                            action.element.classList.remove('hidden');
                        }
                    }
                }, 
                get() {
                    if (action.element instanceof HTMLElement) {
                        return action.element.classList.contains('hidden');
                    }
                }
            });
        })();

        (() => {
            var self = this;
            Object.defineProperty(action, 'name', {
                get() {
                    return Object.keys(self.actions).find(name => self.actions[name] === this);
                }
            });         
        })();

        return action;
    }
    
}

class SimpleToggle extends util.Observer {

    defaultParams = {};

    static create(params) {
        var toggle = new SimpleToggle(params);
        return toggle.init();
    }

    constructor(params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);
        
        /** @private */
        this._element = null;

        /** @private */
        this._bind = this.params.bind;

        return this;
    }

    set enabled(b) {
        if (typeof b === 'boolean') {
            this._bind.context[this._bind.prop] = b;
            if (this.element instanceof HTMLElement) {
                var input = this.element.querySelector('input[type="checkbox"]');
                if (input) {
                    input.checked = b;
                }
            }
        }
    }

    get enabled() {
        var enabled = this._bind.context[this._bind.prop];
        if (this.element instanceof HTMLElement) {
            var input = this.element.querySelector('input[type="checkbox"]');
            if (input) {
                input.checked = enabled;
            }
        }
        return enabled === true;
    }

    set text(t) {
        if (typeof t === 'string' && this.element instanceof HTMLElement) {
            this.element.querySelector('.tp-st-text').innerText = t;
        }
    }

    get text() {
        if (this.element instanceof HTMLElement) {
            var span = this.element.querySelector('.tp-st-text');
            if (span) {
                return span.innerText;
            }
        }
        return this.params.text;
    }

    get element() {
        return this._element;
    }

    /**
     * @public
     */
    init() {
        require('../css/simple-toggle.css');
        const css = new cssModify();
        css.modify('toggle-height', this.params.height);

        var div = document.createElement('div');
        div.innerHTML = require('../html/simple-toggle.html')({
            text: this.text,
            checked: this.enabled ? 'checked' : undefined,
        });
        this._element = div;

        this._element.querySelector('input[type="checkbox"]').addEventListener('change', 
            () => this.toggle.call(this)
        );

        return this;
    }

    destroy() {
        this._element instanceof HTMLElement && this._element.remove();
        this.fireEvent('destroy', this);
    }

    /**
     * @public
     */
    toggle() {
        // console.log('@SimpleToggle/toggle');
        if (this.element instanceof HTMLElement) {
            var input = this.element.querySelector('input[type="checkbox"]');
            if (input) {
                this.enabled = input.checked;
            }
        }
        this.fireEvent('toggle', this, this.enabled);
    }

}

class SimpleButton extends util.Observer {

    defaultParams = {
    };

    styles = {
        BASIC: 'basic',
        DEFAULT: 'default',
        PRIMARY: 'primary',
        SUCCES: 'success',
        INFO: 'info',
        WARNING: 'warning',
        DANGER: 'danger',
        LINK: 'link',
    }

    static create(params) {
        var button = new SimpleButton(params);
        return button.init();
    }

    constructor(params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.validateParams(params);
        this.params = Object.assign({}, this.defaultParams, params);
        
        /** @public */
        this._element = null;

        return this;
    }

    get element() {
        return this._element;
    }

    set style(style) {
        if (this.element instanceof HTMLElement) {
            var button = this.element.querySelector('.tp-sb-button');
            if (button) {
                this.styles.forEach(style => {
                    button.classList.remove(style);
                });
                button.classList.add(style);
            }
        }
        this.params.style = style;
    }

    get style() {
        if (this.element instanceof HTMLElement) {
            var button = this.element.querySelector('.tp-sb-button');
            if (button) {
                var style = this.styles.find(style => {
                    button.classList.contains(style);
                });
                return style ? style : this.styles[DEFAULT];
            }
        }
        return this.params.style;
    }

    set text(text) {
        if (this.element instanceof HTMLElement) {
            var button = this.element.querySelector('.tp-sb-button');
            if (button) {
                button.innerText = text;
            }
        }
        this.params.text = text;
    }

    get text() {
        if (this.element instanceof HTMLElement) {
            var button = this.element.querySelector('.tp-sb-button');
            if (button) {
                return button.innerText;
            }
        }
        return this.params.text;
    }

    /**
     * @public
     */
    init() {
        require('../css/simple-button.scss');
        const css = new cssModify();
        css.modify('button-height', this.params.height);

        var div = document.createElement('div');
        div.innerHTML = require('../html/simple-button.html')({
            text: this.text,
            style: this.style,
        });
        this._element = div;

        this._element.addEventListener('click', event => this.click.call(this, event));
        
        return this;
    }

    destroy() {
        this._element instanceof HTMLElement && this._element.remove();
        this.fireEvent('destroy', this);
    }

    validateParams(params) {
        if (params.style in this.styles) {
            params.style = this.styles[DEFAULT];
        }
    }

    /**
     * @public
     */
    click(event) {
        // console.log('@SimpleButton/click');
        this.fireEvent('click', this, event);
    }

}