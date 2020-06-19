import * as util from './util';
import rangy from "rangy";

export default class Selector {

    static create(params) {
        return new Selector(params);
    }

    constructor(params) {

        const BEFORESTART = 'beforestart';
        const HOVER = 'hover';
        const CHANGE = 'change';
        const STOP = 'stop';
        const CLICK = 'click';
        const DBLCLICK = 'dblclick';


        let _eventListener = {
            [BEFORESTART]: [],
            [HOVER]: [],
            [CHANGE]: [],
            [STOP]: [],
            [CLICK]: [],
            [DBLCLICK]: [],
        }

        const _emit = (event, obj) => {
            let ok = true;
            if (!_eventListener[event]) {
                throw new Error('Event `' + event +'` does not exist')
            }
            for (const listener of _eventListener[event]) {
                ok = listener.call(this, obj) !== false && ok;
            }
            return ok;
        };

        const defaultParams = {
            selectables: ['span', 'div'],
            selectionAreaContainer: 'body',
            ignore: [],
            threshold: 150,
            justClickThreshold: 10,
        };

        // Extract relevant parameters (or defaults)
        params = Object.assign({}, defaultParams, params);
        console.log('@Selector/constructor', params);

        // Initialize selection area container
        const selectionAreaContainer = params.selectionAreaContainer instanceof HTMLElement ? params.selectionAreaContainer : document.querySelector(params.selectionAreaContainer);

        if (!selectionAreaContainer || !(selectionAreaContainer instanceof HTMLElement)) {
            throw new Error('selectionAreaContainer does not exist!');
        }

        // Get all elements that can be selected
        let selectables = [];
        const _resolveSelectables = () => {
            let s = [];
            params.selectables.forEach(selector => {
                const insert = element => !s.includes(element) && s.push(element);
                
                if (selector instanceof HTMLElement) {
                    insert(selector);
                } else {
                    selectionAreaContainer.querySelectorAll(selector).forEach(insert);
                }
            });
            selectables = s;
        };
        _resolveSelectables();
        
        console.log('selectables:', selectables);

        let _oe = undefined;
        let _selected = [];
        let _stored = [];
        let _added = [];
        let _removed = [];
        let _ignored = [];
        let _break = true;
        let _target = undefined;
        let _prevTarget = undefined;
        let _justClick = false;
        
        let _filters = [];
        let _addFilter = (fn, elements) => {
            !_filters.includes(fn) && _filters.push(fn);
            if (elements && elements.constructor === Array) {
                return elements.filter(fn);
            }
            return this;
        };

        let _removeFilter = fn => {
            const index = _filters.indexOf(fn);
            index >= 0 && _filters.splice(index, 1);
        };

        const _clearFilters = () => _filters = [];

        const createEmitObject = () => {
            return {
                inst: this,
                oe: _oe,
                selected: _selected.slice(),
                target: _target,
                changed: {
                    added: _added.slice(),
                    removed: _removed.slice(),
                },
            };
        };
        
        const updateSelected = selected => {

            // Remove ignored and filtered elements
            selected = selected.filter(e => !_ignored.includes(e) && _filters.reduce((ok, fn) => ok && fn(e), true));
            
            let added = [];
            let removed = [];

            selected.forEach(element => !_selected.includes(element) && added.push(element));
            _selected.forEach(element => !selected.includes(element) && removed.push(element));

            _selected = selected;
            _added = added;
            _removed = removed;

            return added.length > 0 || removed.length > 0;
        }

        const _ignore = element => !_ignored.includes(element) && _ignored.push(element);

        // All event handler are defined here
        const eventHandlers = {
            mousedown: event => {
                _resolveSelectables();
                const targets = document.elementsFromPoint(event.x, event.y).filter(element => selectables.includes(element));

                if (!targets || targets.length === 0) {
                    return;
                }

                _prevTarget = _target;

                // User clicks on selectable item
                // Reset state machine variables
                _justClick = true;
                _break = true;
                _selected = _stored;
                _stored = [];
                _ignored = [];

                // Set `_oe` to mousedown event object
                _oe = event;

                for (let i = 0; i < targets.length; i++) {
                    // Emit `beforestart` event and store result
                    let emitObject = createEmitObject();
                    emitObject.target = targets[i];
                    emitObject.event = event;
                    const ok = _emit(BEFORESTART, emitObject);
    
                    // Break if needed
                    if (ok) {
                        _target = targets[i];
                        break;
                    } else if (i === targets.length - 1) {
                        return;
                    }
                }


                // Add clicked element to selection
                let selected = _selected.slice();
                !selected.includes(event.target) && selected.push(event.target);
                updateSelected(selected);
                _emit(CHANGE, createEmitObject());
                _break = false;
            },
            mousemove: event => {
                if (_break) return;

                if (Math.hypot((_oe.x - event.x), (_oe.y - event.y)) > params.justClickThreshold) {
                    _justClick = false;
                }

                console.log('mousemove');

                _prevTarget = _target;
                const targets = document.elementsFromPoint(event.x, event.y).filter(element => !_ignored.includes(element) && selectables.includes(element));

                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    if (target === _prevTarget || _ignored.includes(target)) {
                        continue;
                    } else {
                        let eventObject = createEmitObject();
                        eventObject.target = target;
                        eventObject.event = event;
                        let ok = _emit(HOVER, eventObject);
                        if (ok) {
                            _target = target;
                            break;
                        } else if (i === targets.length - 1) {
                            return;
                        }
                    }
                }

                if (!_target || _prevTarget === _target) {
                    return;
                }

                let range = rangy.createRange();
                range.selectNode(_oe.target);
                const pos = range.compareNode(_target);
                if (pos === 0) {
                    range.setStartBefore(_target);
                } else if (pos === 1) {
                    range.setEndAfter(_target);
                } else if (pos === 2) {
                    range.selectNode(_target);
                }

                // Get elements in range
                let selected = range.getNodes([1], node => selectables.includes(node));

                // Check if selection changed
                const changed = updateSelected(selected);

                // Emit change
                changed && _emit(CHANGE, createEmitObject());
            },
            mouseup: event => {
                if (_break) return;
                _break = true;

                if (_justClick) {
                    updateSelected([]);
                    _emit(CHANGE, createEmitObject());
                } else {
                    _prevTarget = _target;
                    _target = event.target;
    
                    // Emit selected elements
                    let selected = _selected.slice();
                    updateSelected(selected);
                    _emit(STOP, createEmitObject());
                }
            },
            click: event => {
                if (!_justClick) return;

                const targets = document.elementsFromPoint(event.x, event.y).filter(element => selectables.includes(element));
                console.log('targets.length:', targets.length);
                if (targets.length === 0) {
                    _emit(event.type, {
                        oe: event,
                        target: undefined,
                    });
                } else {
                    targets.forEach(target => {
                        const index = _clickedSelectables.indexOf(target);
                        if (index >= 0) {
                            _clickedSelectables.splice(index, 1);
                            _emit('dblclick', {
                                oe: event,
                                target: target,
                            });
                        } else {
                            _clickedSelectables.push(target);
                            setTimeout(() => {
                                const index = _clickedSelectables.indexOf(target);
                                if (index >= 0) {
                                    _clickedSelectables.splice(index, 1);
                                    console.log('emit click', target);
                                    _emit('click', {
                                        oe: event,
                                        target: target,
                                    });
                                }
                            }, 200);
                        }
                    });
                }
            },
        };

        var _clickedSelectables = [];

        const throttledMousemove = eventHandlers.mousemove.throttle(params.threshold);
        const debouncedMousemove = eventHandlers.mousemove.debounce(params.threshold);
        const mouseupHandler = eventHandlers.mouseup;
        const clickHandler = eventHandlers.click;
        const mousedownHandler = eventHandlers.mousedown;

        document.addEventListener('mousemove', throttledMousemove, true);
        document.addEventListener('mousemove', debouncedMousemove, true);
        document.addEventListener('mouseup', mouseupHandler, true);
        selectionAreaContainer.addEventListener('click', clickHandler, true);
        selectionAreaContainer.addEventListener('mousedown', mousedownHandler, true);

        // Add member functions

        this.destroy = () => {
            console.log('Selector destroy');
            document.removeEventListener('mousemove', throttledMousemove, true);
            document.removeEventListener('mousemove', debouncedMousemove, true);
            document.removeEventListener('mouseup', mouseupHandler, true);
            selectionAreaContainer.removeEventListener('click', clickHandler, true);
            selectionAreaContainer.removeEventListener('mousedown', mousedownHandler, true);
        };

        /**
         * @public Remember current `selection` and apply it on next `beforestart` signal
         */
        this.keepSelection = () => _stored = _selected;

        /**
         * @public Add element to ignore list and it will not be in selection (until next `beforestart` event)
         * @param {HTMLElement} element The element to be ignored
         */
        this.ignore = (...args) => _ignore.apply(this, args);

        /**
         * @public Add filter for selection (is applied on next `change` signal)
         * @param {Function} fn Filter that is applied to selection (receives single HTMLElement parameter)
         * @param {Array} [elements] Array of HTMLElement objects to be filtered immediately
         * @returns {Array} Elements that are left after filter is applied to `elements
         */
        this.addFilter = (...args) => _addFilter.apply(this, args);

        /**
         * @public Remove filter for selection (is applied on next `change` signal)
         * @param {*} fn Filter to be removed
         */
        this.removeFilter = (...args) => _removeFilter.apply(this, args);

        this.clearFilters = () => _clearFilters(this);

        /**
         * @public Update objects that can be selected. Call after DOM change
         */
        this.resolveSelectables = (...args) => _resolveSelectables.apply(this, args);

        this.on = (event, fn) => {
            _eventListener[event] && !_eventListener[event].includes(fn) && _eventListener[event].push(fn);
            return this;
        }

        this.off = (event, fn) => {
            if (_eventListener[event]) {
                if (fn) {
                    const index = _eventListener[event].indexOf(fn);
                    index >= 0 && _eventListener[event].splice(index, 1);
                } else {
                    _eventListener[event] = [];
                }
            }
            return this;
        };

        Object.defineProperty(this, 'selectionAreaContainer', {
            get: () => selectionAreaContainer,
        });

        Object.defineProperty(this, 'selectables', {
            get: () => selectables,
        });

        Object.defineProperty(this, 'ignored', {
            get: () => _ignored,
        });

        Object.defineProperty(this, 'filters', {
            get: () => _filters,
        });

        Object.defineProperty(this, 'threshold', {
            get: () => params.threshold,
            set: threshold => params.threshold = threshold
        });

        return this;
    }

}