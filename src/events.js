// =============================================================================
// Boost.js | DOM Events
// (c) 2015 Mathigon
// =============================================================================



// TODO Improve performance after removing click, pointer and scroll events

import * as Elements from 'elements';
import Browser from 'browser';
import { uid } from 'utilities';
import { isString } from 'types';
import { without } from 'arrays';
import { animate } from 'animate';


// -----------------------------------------------------------------------------
// Utilities

export function isSupported(event) {
    event = 'on' + event;
    let $el = $N('div');
    let result = (event in $el._el);
    if (!result) {
        $el.attr(event, 'return;');
        result = (typeof $el._el[event] === 'function');
    }
    $el.delete();
    return result;
}

export function pointerPosition(e) {
    return {
        x: e.targetTouches ? e.targetTouches[0].clientX : e.clientX,
        y: e.targetTouches ? e.targetTouches[0].clientY : e.clientY
    };
}

export function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}

export function svgPointerPosn(event, $svg) {
    // TODO cache values fr efficiency
    let matrix = $svg._el.getScreenCTM().inverse();
    let posn = pointerPosition(event);

    let point = $svg._el.createSVGPoint();
    point.x = posn.x;
    point.y = posn.y;

    point = point.matrixTransform(matrix);
    return { x: point.x, y: point.y };
}


// -----------------------------------------------------------------------------
// Click Events

function makeClickEvent($el) {
    if ($el._events._click) return;
    $el._events._click = true;

    if (!navigator.userAgent.match(/iP(ad|hone|od)/g)) {
        $el._el.addEventListener('click', function(e) { $el.trigger('click', e); });
        return;
    }

    let waitForEvent = false;
    let startX, startY;

    $el._el.addEventListener('touchstart', function(e){
        if (e.touches.length == 1) {
            waitForEvent = true;
            startX = e.changedTouches[0].clientX;
            startY = e.changedTouches[0].clientY;
        }
    });

    $el._el.addEventListener('touchend', function(e){
        if (waitForEvent && e.changedTouches.length == 1) {
            let endX = e.changedTouches[0].clientX;
            let endY = e.changedTouches[0].clientY;
            if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
                $el.trigger('click', e);
            }
        }
        waitForEvent = false;
    });

    $el._el.addEventListener('touchcancel', function(){
        waitForEvent = false;
    });
}

function makeClickOutsideEvent($el) {
    if ($el._events._clickOutside) return;
    $el._events._clickOutside = true;

    Elements.$body.on('click', function(e) {
        if (Elements.$(e.target).hasParent($el)) return;
        $el.trigger('clickOutside');
    });
}


// -----------------------------------------------------------------------------
// Pointer Events
// TODO Make pointer more efficient more efficient using *enter and *leave

function checkInside(element, event) {
    var c = pointerPosition(event);
    return (element._el === document.elementFromPoint(c.x, c.y));
}

function makePointerPositionEvents(element) {
    if (element._data._pointerEvents) return;
    element._data._pointerEvents = true;

    let parent = element.parent;
    let isInside = null;
    parent.on('pointerEnd', function() { isInside = null; });

    parent.on('pointerMove', function(e) {
        let wasInside = isInside;
        isInside = checkInside(element, e);
        if (wasInside != null && isInside && !wasInside) element.trigger('pointerEnter', e);
        if (!isInside && wasInside) element.trigger('pointerLeave', e);
        if (isInside) element.trigger('pointerOver', e);
    });
}

export function slide($el, fns) {
    let isAnimating = false;
    let posn = $el.is('svg') ? function(e) { return svgPointerPosn(e, $el); } : pointerPosition;

    function start(e) {
        e.preventDefault();
        if(e.touches && e.touches.length > 1) return;

        if ('move' in fns) Elements.$body.on('pointerMove', move);
        Elements.$body.on('pointerEnd', end);
        if ('start' in fns) fns.start(posn(e));
    }

    function move(e) {
        e.preventDefault();
        if(isAnimating) return;
        isAnimating = true;

        window.requestAnimationFrame(function() {
            if(!isAnimating) return;
            fns.move(posn(e));
            isAnimating = false;
        });
    }

    function end(e) {
        e.preventDefault();
        if(e.touches && e.touches.length > 0) return;
        isAnimating = false;

        if ('move' in fns) Elements.$body.off('pointerMove', move);
        Elements.$body.off('pointerEnd', end);

        if ('end' in fns) fns.end();
    }

    $el.on('pointerStart', start);
}


// -----------------------------------------------------------------------------
// Scroll Events

function makeScrollEvents(element) {
    if (element._data._scrollEvents) return;
    element._data._scrollEvents = true;

    if (!element._isWindow) element.fixOverflowScroll();

    let ticking = false;

    function scroll() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                element.trigger('scroll', { top: element.scrollTop });
                ticking = false;
            });
        }
        ticking = true;
    }

    // Mouse Events
    let target = element._isWindow ? window : element._el;
    target.addEventListener('scroll', scroll);

    // Touch Events
    function touchStart() {
        window.addEventListener('touchmove', scroll);
        window.addEventListener('touchend', touchEnd);
    }
    function touchEnd() {
        window.removeEventListener('touchmove', scroll);
        window.removeEventListener('touchend', touchEnd);
    }
    element._el.addEventListener('touchstart', touchStart);
}


// -----------------------------------------------------------------------------
// Event Bindings

const customEvents = {
    pointerStart: 'mousedown touchstart',
    pointerMove:  'mousemove touchmove',
    pointerEnd:   'mouseup touchend touchcancel',

    change: 'propertychange keyup input paste',
    scrollwheel: 'DOMMouseScroll mousewheel',

    click: makeClickEvent,  // no capture!
    clickOutside: makeClickOutsideEvent,  // no capture!

    pointerEnter: makePointerPositionEvents,  // no capture!
    pointerLeave: makePointerPositionEvents,  // no capture!
    pointerOver: makePointerPositionEvents,  // no capture!

    scrollStart: makeScrollEvents,  // no capture!
    scroll: makeScrollEvents,  // no capture!
    scrollEnd: makeScrollEvents  // no capture!
};

export function createEvent($el, event, fn, useCapture) {
    let custom = customEvents[event];

    if (isString(custom)) {
        $el.on(custom, fn, useCapture);
    } else if (custom) {
        custom($el);
    } else {
        $el._el.addEventListener(event, fn, !!useCapture);
    }

    if (event in $el._events) {
        if ($el._events[event].indexOf(fn) < 0) $el._events[event].push(fn);
    } else {
        $el._events[event] = [fn];
    }
}

export function removeEvent($el, event, fn, useCapture) {
    let custom = customEvents[event];

    if (isString(custom)) {
        $el.off(custom, fn, useCapture);
        return;
    } else if (!custom) {
        $el._el.removeEventListener(event, fn, !!useCapture);
    }

    if (event in $el._events) $el._events[event] = without($el._events[event], fn);
}