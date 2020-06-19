function parse(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

function textMetrics(string, container) {
    var h = 0, w = 0;
    var div = document.createElement('div');
    if (container && container.appendChild) {
        container.appendChild(div);
    } else {
        document.body.appendChild(div);
    }
    div.style['position'] = 'absolute';
    div.style['left'] = '-1000';
    div.style['top'] = '-1000';
    div.style['color'] = 'transparent';
    // div.style['display'] = 'none';

    div.innerText = string;

    var styles = ['font-size','font-style', 'font-weight', 'font-family','line-height', 'text-transform', 'letter-spacing'];

    styles.forEach(styleProperty => {
        if (container && container.style) {
            div.style[styleProperty] = container.style[styleProperty];
        } else {
            div.style[styleProperty] = document.body.style[styleProperty];
        }
    });
    
    w = div.clientWidth;
    h = div.clientHeight;
    
    div.remove();

    return {
        width: w,
        height: h,
    };

}

/**
 * 
 * @param {String} el 
 * @param {Object} attr 
 * @returns {HTMLElement}
 */
function create(el, attr) {
    var element = document.createElement(el);
    if (attr) {
        for (var name in attr) {
            if (element[name] !== undefined) {
                element[name] = attr[name];
            }
        }
    }
    return element;
}

function forceHorizontalScroll(container) {
    function scrollHorizontally(e) {
        e = window.event || e;
        var delta = Math.max(-1, Math.min(1, (e.deltaY || e.wheelDelta || -e.detail)));
        // console.log('wheel', delta, e);
        container.scrollLeft += (delta * 40); // Multiplied by 40
        e.preventDefault();
    }
    if (container.addEventListener) {
        container.addEventListener("wheel", scrollHorizontally, false);
    } else {
        // IE 6/7/8
        container.attachEvent("onmousewheel", scrollHorizontally);
    }
}

function coordinatesInElement(element, {y, x}) {
    var rect = element.getBoundingClientRect();
    var X = x - rect.left; //x position within the element.
    var Y = y - rect.top;  //y position within the element.
    if (X >= 0 && X <= rect.width && Y >= 0 && Y <= rect.height) {
        return {
            x: X,
            y: Y,
        };
    } else {
        return {};
    }
}

export default {
    parse,
    textMetrics,
    create,
    forceHorizontalScroll,
    coordinatesInElement,
}