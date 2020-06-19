import * as util from './util';
import TranscriptionView from './transcription-view';
import rangy from "rangy";
import Selector from './selector';
import RegionsPlugin from 'wavesurfer.js/src/plugin/regions.js';

export default class TranscriptionComponent extends util.Observer {

    defaultParams = {};

    static create(container, params) {
        var transcriptionComponent = new TranscriptionComponent(container, params);
        return transcriptionComponent.init();
    }

    constructor(container, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);

        /** 
         * @private
         * @type {HTMLElement}
         */
        this.container = container;

        /** @private TranscriptionView object */
        this.view = null;

        /**
         * @private
         * @type {Array}
         */
        this.transcription = null;

        this.previousTime = null;
        this.currentLineIndex = null;

        this.ready = false;

        return this;
    }

    set isLyricsMode(b) {
        // console.log('@TranscriptionComponent/set isLyricsView', b);
        this.view.isLyricsMode = b;
    }

    get isLyricsMode() {
        // console.log('@TranscriptionComponent/get isLyricsView');
        return this.view.isLyricsMode;
    }

    init() {
        this.view = TranscriptionView.create(this.container, this.params);
        this.view.load(this.promiseTranscription()).then(transcription => {
            this.transcription = transcription;
            this.ready = true;
            this.fireEvent('ready');
        });

        this.view.on('goto', index => {
            const time = this.transcription[index].start;
            this.fireEvent('goto', time || (this.transcription[index - 1] ? (this.transcription[index - 1].end || 0) : 0));
        });
        this.view.on('section-created', params => this.fireEvent('section-created', params));
        this.view.on('section-mouseenter', index => this.fireEvent('section-mouseenter', index));
        this.view.on('section-mouseleave', index => this.fireEvent('section-mouseleave', index));

        return this;
    }

    destroy() {

    }

    promiseTranscription(url) {
        url = url ? url : this.params.transcriptionUrl;
        let options = Object.assign({
                url: url,
                responseType: 'json'
            },
            this.params.xhr
        );
        const request = util.fetchFile(options);
        return request.promise;
    }

    onTimeUpdated(currentTime) {
        if (!this.ready || !this.transcription) {
            return;
        }

        
        var setCurrentLineIndex = f => {
            this.currentLineIndex = f.call(this);
            this.view.setLineAsCurrent(this.currentLineIndex);
            return this.currentLineIndex >= 0 && this.currentLineIndex < this.transcription.length;
        };
        
        var incCurrentLine = () => setCurrentLineIndex.call(this, () => this.currentLineIndex + 1);
        var decCurrentLine = () => setCurrentLineIndex.call(this, () => this.currentLineIndex - 1);
        
        var getCurrentLine = () => Object.assign({
            start: this.transcription[this.currentLineIndex - 1] ? this.transcription[this.currentLineIndex - 1].end || 0 : 0,
            end: this.transcription[this.currentLineIndex + 1] ? this.transcription[this.currentLineIndex + 1].start || Infinity : Infinity,
        }, this.transcription[this.currentLineIndex]);

        // var getCurrentLine = () => this.transcription[this.currentLineIndex] || {};

        var isCurrentLineIndexInBounds = () => this.currentLineIndex < this.transcription.length && this.currentLineIndex >= 0;
        
        if (this.previousTime == null) {
            // console.log();
            this.previousTime = 0;
            this.currentLineIndex = -1;
            incCurrentLine.call(this);
        }

        // console.log('current line:', getCurrentLine.call(this));
        if (this.previousTime <= currentTime) {
            while( 
                (this.currentLineIndex < 0 || isCurrentLineIndexInBounds.call(this) && currentTime >= getCurrentLine.call(this).end)
                && incCurrentLine.call(this) 
                ) {}
            } else {
                while(
                (this.currentLineIndex >= this.transcription.length || isCurrentLineIndexInBounds.call(this) && currentTime < getCurrentLine.call(this).start) 
                && decCurrentLine.call(this) 
                ) {}
            }
            
        if (isCurrentLineIndexInBounds.call(this) && currentTime >= getCurrentLine.call(this).start && currentTime <= getCurrentLine.call(this).end) {
            this.view.setLineAsActive(this.currentLineIndex);
            const duration = getCurrentLine.call(this).end - getCurrentLine.call(this).start;
            const played = currentTime - getCurrentLine.call(this).start;
            this.view.setProgress(played / duration);
        }
        
        this.previousTime = currentTime;
        
        // console.log('onTimeUpdated', currentTime, this.currentLineIndex);
    }

    startEditing() {
        this.previousTime = null;        
        this.view.setStateEditing();
        // return;
        /**
         * @type {HTMLDivElement}
         */
        const container = this.container;

        const sectionsCollection = container.getElementsByClassName('selected');

        this.highlightSection = index => sectionsCollection[index] && sectionsCollection[index].classList.add('highlight');
        this.unhighlightSection = index => sectionsCollection[index] && sectionsCollection[index].classList.remove('highlight');
        
        const deactivateAllSections = () => Array.prototype.slice.call(this.container.querySelectorAll('.selected.active')).forEach(e => e.classList.remove('active'));

        this.activateSection = index => {
            deactivateAllSections();
            sectionsCollection[index] && sectionsCollection[index].classList.add('active');
        };

        this.removeSection = index => {
            const section = sectionsCollection[index];
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
        };

        const calculateSectionIndex = section => {
            if (section instanceof HTMLElement) {
                return Array.prototype.slice.call(sectionsCollection).findIndex(el => el === section);
            }
        };

        /**
         * 
         * @param {Array of HTMLElement} elements Array of HTMLElement objects from which to find 
         * @returns {rangy.RangePrototype}
         */
        const getRange = (elements) => {
            let range = rangy.createRange();
            elements && elements.forEach(node => {
                if (range.collapsed) {
                    range.selectNode(node);
                } else {
                    const pos = range.compareNode(node);
                    if (pos === 0) {
                        range.setStartBefore(node);
                    } else if (pos === 1) {
                        range.setEndAfter(node);
                    } else if (pos === 2) {
                        range.selectNode(node);
                    }
                }
            });
            return range;
        };

        const surround = elements => {
            // surround elements from selection with div
            let range = getRange(elements);
            if (range.isValid() && !range.collapsed && range.canSurroundContents()) {
                let wrapper = util.html.create('div', {
                    className: 'selected',
                });

                range.surroundContents(wrapper);
                wrapper.appendChild(util.html.create('span', {
                    className: 'handle',
                    innerHTML: '|',
                }));

                wrapper.insertBefore(util.html.create('span', {
                    className: 'handle',
                    innerHTML: '|',
                }), wrapper.firstChild);

                this.view.addSectionEventHandlers(wrapper);
            }
        };

        const isNonSelectedSpan = el => el instanceof HTMLSpanElement && el.parentElement === container;
        const isHandle = el => el instanceof HTMLSpanElement && el.parentElement.classList.contains('selected') && el.classList.contains('handle');
        const isSelectedDiv = el => el instanceof HTMLDivElement && el.classList.contains('selected') && el.parentElement === container;

        /**
         * @param {HTMLElement} pivot 
         * @param {NodeList} dividers 
         * @returns {boolean}
         */
        const isInSameSectionAs = (pivot, dividers) => {
            dividers = Array.prototype.slice.call(dividers);
            const ranges = dividers.map(el => {
                let range = rangy.createRange(el);
                range.selectNode(el);
                return range;
            });
            const comparedToPivot = ranges.map(range => range.compareNode(pivot));
            return el => {
                return ranges.reduce((ok, range, index) => ok && range.compareNode(el) === comparedToPivot[index], true);
            }
        };

        /**
         * @description Checks whether element is left handle
         * @param {HTMLElement} handle 
         * @returns {boolean}
         */
        const isLeftHandle = handle => 
            handle instanceof HTMLSpanElement 
                && handle.classList.contains('handle') 
                && handle.parentElement.firstChild === handle;

        /**
         * @param {HTMLElement} handle
         * @returns {Function}
         */
        const isValidForResizing = handle => {
            // const selected = container.querySelectorAll('.selected');

            /** @type {HTMLElement[]} */
            const sections = Array.prototype.slice.call(sectionsCollection);
            const sectionIndex = sections.indexOf(handle.parentElement);
            const validRange = rangy.createRange();
            if (isLeftHandle(handle)) {

                if (sectionIndex === 0) {
                    validRange.setStartBefore(container);
                } else {
                    validRange.setStartAfter(sections[sectionIndex - 1]);
                }

                validRange.setEndAfter(handle.parentElement);
                
            } else {
                validRange.setStartBefore(handle.parentElement);

                if (sectionIndex === sections.length - 1) {
                    validRange.setEndAfter(container);
                } else {
                    validRange.setEndBefore(sections[sectionIndex + 1]);
                }

            }
            return e => 
                e instanceof HTMLSpanElement && !e.classList.contains('handle')
                && (!validRange.isValid() || validRange.containsNodeContents(e));
        };

        /**
         * @description
         * @param {HTMLSpanElement} handle 
         * @param {HTMLSpanElement[]} elements
         */
        const changeSelection = (handle, elements) => {
            const selection = handle.parentElement;
            const range = getRange(elements);
            if (!range.isValid || !range.canSurroundContents()) {
                return false;
            }
            const emitSectionRemoved = (index => () => this.fireEvent('section-removed', index))(calculateSectionIndex(selection));
            const orderedElements = range.getNodes([1], e => elements.includes(e));
            console.log('changeSelection orderedElements:', orderedElements);
            if (isLeftHandle(handle)) {
                if (range.compareNode(selection) === range.NODE_AFTER) {
                    // extend to left
                    for (let i = orderedElements.length - 1; i >= 0; i--) {
                        handle.insertAdjacentElement('afterend', orderedElements[i]);
                    }
                } else {
                    // shrink from left
                    // for (let i = 0; i < orderedElements.length; i++) {
                    //     selection.insertAdjacentElement('beforebegin', orderedElements[i]);
                    // }
                    orderedElements.forEach((el, index) => {
                        console.log(index);
                        selection.insertAdjacentElement('beforebegin', el);
                    });
                    if (selection.childElementCount < 3) {
                        selection.remove();
                        emitSectionRemoved();
                    }
                }
            } else {
                if (range.compareNode(selection) === range.NODE_BEFORE) {
                    // extend to right
                    for (let i = 0; i < orderedElements.length; i++) {
                        handle.insertAdjacentElement('beforebegin', orderedElements[i]);
                    }
                } else {
                    // shrink from right
                    for (let i = orderedElements.length - 1; i >= 0; i--) {
                        selection.insertAdjacentElement('afterend', orderedElements[i]);
                    }
                    if (selection.childElementCount < 3) {
                        selection.remove();
                        emitSectionRemoved();
                    }
                }
            }
        };

        /**
         * @type {Selector}
         */
        this.selector = Selector.create({
            selectionAreaContainer: container,
            selectables: ['span', 'div'],
        }).on('beforestart', e => {
            console.log('beforestart', e);

            // If non selected item has been clicked
            // add filters so only non selected items are in selection
            if (isNonSelectedSpan(e.target)) {
                e.inst.addFilter(isNonSelectedSpan);
                // e.inst.addFilter(isInSameSectionAs(e.target, container.querySelectorAll('.selected')));
                e.inst.addFilter(isInSameSectionAs(e.target, sectionsCollection));
            } else if (isHandle(e.target)) {
                // e.inst.addFilter(el => el instanceof HTMLSpanElement && !el.classList.contains('handle'));
                e.inst.addFilter(isValidForResizing(e.target));
            }
            
        }).on('change', e => {
            console.log('change', e);

            // If non selected item was clicked (set as pivot)
            // Update `selecting` items
            if (isNonSelectedSpan(e.oe.target) || isHandle(e.oe.target)) {
                e.changed.removed.forEach(el => el.classList.remove('selecting'))
                e.changed.added.forEach(el => el.classList.add('selecting'))
            }
        }).on('stop', e => {
            console.log('stop', e);

            // Remove all filters
            e.inst.clearFilters();
            
            // Remove `selecting` class from selected elements
            e.selected.forEach(el => el.classList.remove('selecting'));

            // If non selected item was clicked (set as pivot)
            // Surround selection with div with class `selected`
            if (isNonSelectedSpan(e.oe.target)) {
                surround(e.selected);
            } else if (isHandle(e.oe.target)) {
                changeSelection(e.oe.target, e.selected);
            }

        }).on('hover', e => {
            console.log('hover', e);

            if (isHandle(e.oe.target) && isSelectedDiv(e.target)) {
                return false;
            }

        }).on('click', e => {
            console.log('click', e);
            if (e.target === undefined) {
                this.fireEvent('section-click', -1);
            } else if (isSelectedDiv(e.target)) {
                this.fireEvent('section-click', calculateSectionIndex(e.target));
            }
        }).on('dblclick', e => {
            console.log('dblclick', e);
            if (e.target === undefined) {
                this.fireEvent('section-dblclick', -1);
            } else if (isSelectedDiv(e.target)) {
                // TODO: start editing text
                this.fireEvent('section-dblclick', calculateSectionIndex(e.target));
            }
        });

    }

    doneEditing(regions) {

        console.log('@doneEditing', regions);

        const getTranscription = () => {
            console.log('@getTranscription');
            let transcription = [];
            let currentText = '';
            let regionIndex = 0;
            for (let i = 0; i < this.container.childNodes.length; i++) {
                const node = this.container.childNodes[i];
                console.log(node);
                // Check node type: text node, not selected span, or div with more nodes inside?
                if (node.nodeType === 3) {
                    currentText += node.textContent;
                } else if (node instanceof HTMLSpanElement) {
                    currentText += node.textContent;
                } else if (node instanceof HTMLDivElement) {
                    currentText = currentText.trim();
                    if (currentText.length > 0) {
                        transcription.push({
                            text: currentText,
                        });

                        // Set `currentText` to empty string again to prepare for next extraction
                        currentText = '';
                    }
                    
                    // Extract text from div node
                    // Possibly `selected` with multiple nodes inside
                    // or just with single text node
                    for (let j = 0; j < node.childNodes.length; j++) {
                        const innerNode = node.childNodes[j];
                        // Skip contents of handles
                        if (innerNode instanceof HTMLElement && innerNode.classList.contains('handle')) {
                            continue;
                        } else {
                            currentText += innerNode.textContent;
                        }
                    }

                    currentText = currentText.trim();
                    // TODO: set end and start time as well
                    const {start, end} = regions[regionIndex++] || {};
                    transcription.push({
                        text: currentText,
                        start: start,
                        end: end,
                    });

                    // Set to empty string again
                    currentText = '';
                }
            }

            // Check if `currentText` is not empty. This means that last node was
            // not div node.
            // TODO: Move this into a function?
            currentText = currentText.trim();
            if (currentText.length > 0) {
                transcription.push({
                    text: currentText,
                });
            }

            return transcription;

        };

        let transcription = [];
        if (regions !== undefined) {
            // Update transcription
            transcription = getTranscription();
            console.log('new transcription data:', transcription);

            // Validate transcription

            // Check if any changes
            this.view.load(transcription).then(transcription => {
                this.transcription = transcription;
                this.view.setStateViewing();
            });
        } else {
            transcription = this.transcription;
            this.view.setStateViewing();
        }

        this.selector && this.selector.destroy && this.selector.destroy();

        return transcription;
    }
    
}