import * as util from './util';
import '../css/annotator.scss'
import rangy from "rangy";

export default class Annotator extends util.Observer {

    defaultParams = {

    }

    constructor(element, params) {
        super();

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        this.params = Object.assign({}, this.defaultParams, params);

        /**
         * HTMLElement that Annotator object listens to
         * @private
         */
        this.element = element;

        /**
         * Object that stores annotations data
         * @private
         */
        this.annotations = {};

        this.addListeners();

        return this;
    }

    addListeners() {

        this.element.classList.add('annotator');

        let addHandleHandlers = (handle) => {
            if (!(handle instanceof HTMLElement)) {
                throw new TypeError('invalid parameter handle');
            }

            let onMouseMove = event => {
                console.log('handle moved');
            };

            handle.addEventListener('mousedown', event => {
                document.addEventListener('mousemove', onMouseMove);
                this.handleDown = true;
            });
            
            this.on('selected', range => {
                document.removeEventListener('mousemove', onMouseMove);
                this.handleDown = false;
                // classApplier.apply(range, true)
            });
        };


        /**
         * @param {HTMLElement} element 
         * @param {String} className 
         * @returns {ClassApplier}
         */
        let createClassApplier = (element, className) => {
            if (!(element instanceof HTMLElement)) {
                throw new TypeError('invalid element');
            }
            if (typeof className !== 'string') {
                throw new TypeError('invalid className');
            }

            var expandRangeToNode = (range, node, unwrap = false) => {
                if (!(range instanceof rangy.RangePrototype)) {
                    throw new TypeError('invalid range');
                }
                if (!(node instanceof HTMLElement)) {
                    throw new TypeError('invalid node');
                }
                if (typeof unwrap !== 'boolean') {
                    throw new TypeError('invalid parameter');
                }

                console.log('expandRangeToNode');
                let rng = rangy.createRange();
                rng.selectNode(node);
                let res = expandRangeToRange(range, rng, unwrap);
                if (unwrap && range.intersectsRange(rng)) {
                    let content = rng.toString();
                    rng.insertNode(document.createTextNode(content));
                    node.remove();
                }
                return res;
            };

            var expandRangeToRange = (range1, range2) => {
                if (!(range1 instanceof rangy.RangePrototype) 
                ||  !(range2 instanceof rangy.RangePrototype)) {
                    throw new TypeError('invalid range');
                }
                console.log(range1.toHtml(), '|', range2.toHtml(), '|', range1.intersectsOrTouchesRange(range2));
                console.log(range1.endOffset, '|', range2.startOffset, '|', range1.intersectsOrTouchesRange(range2));
                console.log('range1:', range1.startContainer, range1.startOffset, range1.endOffset, range1.commonAncestorContainer);
                console.log('range2:', range2.startContainer, range2.startOffset, range2.endOffset, range2.commonAncestorContainer);
                if (range1.intersectsRange(range2)) {
                    return range1.union(range2);
                }
                return range1;
            };

            var expandRangeTo = (range, rangeOrNode, unwrap = false) => {
                console.log('expandRangeTo', this);
                if (!(range instanceof rangy.RangePrototype)) {
                    throw new TypeError('invalid range');
                }
                if (rangeOrNode instanceof rangy.RangePrototype) {
                    return expandRangeToRange(range, rangeOrNode);
                } else if (rangeOrNode instanceof HTMLElement) {
                    return expandRangeToNode(range, rangeOrNode, unwrap);
                } else {
                    throw new TypeError('invalid parameter');
                }
            };

            var differenceToNode = (range, node) => {

                if (!range.intersectsNode(node)) {
                    return [ range.cloneRange() ];
                }

                var trimEnd = (range, node) => {
                    let rng = range.cloneRange();
                    rng.setEndBefore(node);
                    if (rng.isValid()) {
                        return rng;
                    } else {
                        return rng.collapseBefore(node);
                    }
                };

                var trimStart = (range, node) => {
                    let rng = range.cloneRange();
                    rng.setStartAfter(node);
                    if (rng.isValid()) {
                        return rng;
                    } else {
                        return rng.collapseAfter(node);
                    }
                };

                let c = range.compareNode(node);
                if (c === 1) {
                    return [ trimEnd(range, node) ];
                } else if (c === 0) {
                    return [ trimStart(range, node) ];
                } else if (c === 3) {
                    if (node.innerText === range.toString()) {
                        let r = range.cloneRange();
                        r.collapse(true);
                        return [ r ];
                    } else {
                        return [ trimEnd(range, node), trimStart(range, node) ];
                    }
                } else {
                    let r = range.cloneRange();
                    r.collapse(true);
                    return [ r ];
                }
            };

            var apply = (range, join = false) => {
                if (!(range instanceof rangy.RangePrototype)) {
                    throw new TypeError('invalid range');
                }

                var surround = (range) => {

                    let createHandle = () => {
                        let handle = util.html.create('span', {
                            className: 'handle',
                        });
                        addHandleHandlers(handle);
                        return handle;
                    }

                    if (range.isValid() && !range.collapsed && range.canSurroundContents() && range.toString()) {

                        let innerSpan = util.html.create('span', {
                            className: 'inner',
                        });

                        range.surroundContents(innerSpan);
                        innerSpan.normalize();

                        let containerSpan = util.html.create('span', {
                            className: className,
                        });

                        range.surroundContents(containerSpan);
                        
                        containerSpan.appendChild(createHandle());
                        containerSpan.insertBefore(createHandle(), containerSpan.firstChild);
                        
                        console.log('annotated', annotations.length);
                        return containerSpan;
                    }
                }

                if (!range.collapsed) {
                    var arr = Array.prototype.slice.call( annotations )
                    if (join) {
                        console.log('@apply>join', range, range.isValid());
                        console.log('@apply>join', range.toHtml());
                        for (let i = 0; i < arr.length; i++) {
                            range = expandRangeTo(range, arr[i], true);
                        }
                    } else {
                        for (let i = 0; i < arr.length; i++) {
                            if (range.intersectsNode(arr[i], true)) {
                                let ranges = differenceToNode(range, arr[i]);
                                if (ranges.length > 1) {
                                    return apply(ranges[0]).concat(apply(ranges[1]));
                                } else {
                                    range = ranges[0];
                                }
                            }
                        }
                    }
                    surround(range);
                }
                rangy.getSelection().removeAllRanges();
                return [range];
            };

            var remove = (range) => {
                if (!(range instanceof rangy.RangePrototype)) {
                    throw new TypeError('invalid range');
                }

                console.log('@remove', range.toHtml());
            };

            // get all HTMLElements with class <className>
            // and add them into <annotations>
            var annotations = element.getElementsByClassName(className);

            return {
                apply,
                remove,
            };

        };

        let classApplier = createClassApplier(this.element, 'annotated');

        this.on('selected', range => {
            console.log('selected', range.toString(), range.toHtml());

            if (!this.handleDown) {
                classApplier.apply(range, false);
            }
            // classApplier.apply(range, this.handleDown);
            return;
        });

        this.on('mouseup', () => {
            let selection = rangy.getSelection();
            if (selection.rangeCount > 0) {
                let range = selection.getRangeAt(0);
                if (range && !range.collapsed) {
                    this.fireEvent('selected', range);
                }
            }
        });

        document.addEventListener('mouseup', event => this.fireEvent.call(this, event.type, event));
        // this.element.addEventListener('mouseup', event => this.fireEvent.call(this, event.type, event));
    }
}