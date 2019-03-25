// =============================================================================
// Boost.js | Animations
// (c) Mathigon
// =============================================================================



import {defer, delay, total, toCamelCase} from '@mathigon/core';

// prevent animations on page load
let isReady = false;
setTimeout(function() { isReady = true; });

const BOUNCE_IN = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
const BOUNCE_OUT = 'cubic-bezier(0.68, -0.275, 0.825, 0.115)';


// -----------------------------------------------------------------------------
// Simple Animations

export function animate(callback, duration) {
  if (duration === 0) { callback(); return; }

  let startTime = Date.now();
  let lastTime = 0;
  let running = true;

  const deferred = defer();
  const then = deferred.promise.then.bind(deferred.promise);
  const cancel = () => { running = false; deferred.reject(); };

  function getFrame() {
    if (running && (!duration || lastTime <= duration))
      window.requestAnimationFrame(getFrame);

    const time = Date.now() - startTime;
    callback(duration ? Math.min(1,time/duration) : time, time - lastTime, cancel);
    if (duration && time >= duration) deferred.resolve();
    lastTime = time;
  }

  getFrame();
  return {cancel, then};
}


// -----------------------------------------------------------------------------
// Easing

function easeIn(type, t, s) {
  switch (type) {

    case 'quad':   return t * t;
    case 'cubic':  return t * t * t;
    case 'quart':  return t * t * t * t;
    case 'quint':  return t * t * t * t * t;
    case 'circ':   return 1 - Math.sqrt(1 - t * t);
    case 'sine':   return 1 - Math.cos(t * Math.PI / 2);
    case 'exp':    return (t <= 0) ? 0 : Math.pow(2, 10 * (t - 1));

    case 'back':
      if (!s) s = 1.70158;
      return t * t * ((s + 1) * t - s);

    case 'elastic':
      if (!s) s = 0.3;
      return - Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1) * 2 / s - 0.5) * Math.PI );

    case 'swing':
      return 0.5 - Math.cos(t * Math.PI) / 2;

    case 'spring':
      return 1 - (Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6));

    case 'bounce':
      if (t < 1/11) return 1/64 - 7.5625 * (0.5/11 - t) * (0.5/11 - t);  // 121/16 = 7.5625
      if (t < 3/11) return 1/16 - 7.5625 * (  2/11 - t) * (  2/11 - t);
      if (t < 7/11) return 1/4  - 7.5625 * (  5/11 - t) * (  5/11 - t);
      return 1    - 7.5625 * (     1 - t) * (     1 - t);

    default:
      return t;
  }
}

export function ease(type, t = 0, s = 0) {

  if (t === 0) return 0;
  if (t === 1) return 1;
  type = type.split('-');

  if (type[1] === 'in')  return     easeIn(type[0], t, s);
  if (type[1] === 'out') return 1 - easeIn(type[0], 1 - t, s);
  if (t <= 0.5)          return     easeIn(type[0], 2 * t,     s) / 2;
  return 1 - easeIn(type[0], 2 * (1-t), s) / 2;
}


// -----------------------------------------------------------------------------
// Element Animations

export function transition($el, properties, duration=400, _delay=0, easing='ease-in-out') {
  if (!isReady) {
    Object.keys(properties).forEach(k => { let p = properties[k]; $el.css(k, Array.isArray(p) ? p[1] : p); });
    return Promise.resolve();
  }

  if (easing === 'bounce-in') easing = BOUNCE_IN;
  if (easing === 'bounce-out') easing = BOUNCE_OUT;

  // Cancel any previous animations
  if ($el._data._animation) $el._data._animation.cancel();

  const to = {}, from = {};
  const deferred = defer();

  const style = window.getComputedStyle($el._el);
  Object.keys(properties).forEach((k) => {
    const p = properties[k];
    const k1 = toCamelCase(k);
    from[k1] = Array.isArray(p) ? p[0] : style.getPropertyValue(k);
    to[k1] = Array.isArray(p) ? p[1] : p;
    // Set initial style, for the duration of the delay.
    if (_delay) $el.css(k, from[k1]);
  });

  // Special rules for animations to height: auto
  let oldHeight = to.height;
  if (to.height === 'auto') to.height = total($el.children.map($c => $c.outerHeight)) + 'px';

  let player;
  let cancelled = false;

  delay(() => {
    if (cancelled) return;

    player = $el._el.animate([from, to], {duration, easing, fill: 'forwards'});
    player.onfinish = function(e) {
      if ($el._el) Object.keys(properties).forEach(k => $el.css(k, k === 'height' ? oldHeight : to[k]));
      deferred.resolve(e);
      player.cancel();  // bit ugly, but needed for Safari...
    };
  }, _delay);

  const animation = {
    then: deferred.promise.then.bind(deferred.promise),
    cancel() {
      cancelled = true;
      if ($el._el) Object.keys(properties).forEach(k => $el.css(k, $el.css(k)));
      if (player) player.cancel();
    }
  };

  // Only allow cancelling of animation in next thread.
  setTimeout(() => $el._data._animation = animation);
  return animation;
}


// -----------------------------------------------------------------------------
// Element CSS Animations Effects

// When applying the 'pop' effect, we want to respect all existing transform
// except scale. To do that, we have to expand the matrix() notation.
const cssMatrix = /matrix\([0-9.\-\s]+,[0-9.\-\s]+,[0-9.\-\s]+,[0-9.\-\s]+,([0-9.\-\s]+),([0-9.\-\s]+)\)/;

export function enter($el, effect='fade', duration=500, _delay=0) {
  $el.show();
  if (!isReady) return Promise.resolve();

  if (effect === 'fade') {
    return transition($el, {opacity: [0, 1]}, duration, _delay);

  } else if (effect === 'pop') {
    const transform = $el.transform.replace(/scale\([0-9.]*\)/, '')
      .replace(cssMatrix, 'translate($1px,$2px)');

    // TODO Merge into one transition.
    transition($el, {opacity: [0, 1]}, duration, _delay);
    return transition($el, {transform: [transform + ' scale(0.5)',
        transform + ' scale(1)']}, duration, _delay, 'bounce-in');

  } else if (effect === 'descend') {
    const rules = {opacity: [0, 1], transform: ['translateY(-50%)', 'none']};
    return transition($el, rules, duration, _delay);

  } else if (effect.startsWith('draw')) {
    const l = $el.strokeLength + 'px';
    $el.css({opacity: 1, 'stroke-dasharray': l});
    const start = (effect === 'draw-reverse') ? '-' + l : l;
    const rules = {'stroke-dashoffset': [start, 0]};
    return transition($el, rules, duration, _delay, 'linear')
        .then(() => $el.css('stroke-dasharray', ''));

  } else if (effect.startsWith('slide')) {
    const rules = {opacity: [0, 1], transform: ['translateY(50px)', 'none']};
    if (effect.includes('down')) rules.transform[0] = 'translateY(-50px)';
    return transition($el, rules, duration, _delay);

  } else if (effect.startsWith('reveal')) {
    const rules = {opacity: [0, 1], height: [0, 'auto']};
    if (effect.includes('left')) rules.transform = ['translateX(-50%)', 'none'];
    if (effect.includes('right')) rules.transform = ['translateX(50%)', 'none'];
    return transition($el, rules, duration, _delay);
  }
}

export function exit($el, effect='fade', duration=400, delay=0, remove=false) {
  if (!$el._el) return Promise.resolve();
  if (!isReady) { $el.hide(); return Promise.resolve(); }
  if ($el.css('display') === 'none') return Promise.resolve();

  let animation;

  if (effect === 'fade') {
    animation = transition($el, {opacity: [1, 0]}, duration, delay);

  } else if (effect === 'pop') {
    const transform = $el.transform.replace(/scale\([0-9.]*\)/, '');

    transition($el, {opacity: [1, 0]}, duration, delay);
    animation = transition($el, {transform: [transform + ' scale(1)',
        transform + ' scale(0.5)']}, duration, delay, 'bounce-out');

  } else if (effect === 'ascend') {
    const rules = {opacity: [1, 0], transform: ['none', 'translateY(-50%)']};
    animation = transition($el, rules, duration, delay);

  } else if (effect.startsWith('draw')) {
    const l = $el.strokeLength + 'px';
    $el.css('stroke-dasharray', l);
    const end = (effect === 'draw-reverse') ? '-' + l : l;
    const rules = {'stroke-dashoffset': [0, end]};
    animation = transition($el, rules, duration, delay, 'linear');

  } else if (effect.startsWith('slide')) {
    const rules = {opacity: 0, transform: 'translateY(50px)'};
    if (effect.includes('up')) rules.transform = 'translateY(-50px)';
    animation = transition($el, rules, duration, delay);

  } else if (effect.startsWith('reveal')) {
    const rules = {opacity: 0, height: 0};
    if (effect.includes('left')) rules.transform = 'translateX(-50%)';
    if (effect.includes('right')) rules.transform = 'translateX(50%)';
    animation = transition($el, rules, duration, delay);
  }

  animation.then(() => remove ? $el.remove() : $el.hide());
  return animation;
}

// These animations are defined in effects.css:
// pulse-down, pulse-up, flash, bounce-up, bounce-right
export function effect(element, name) {
  element.animationEnd(function(){
    element.removeClass('effects-' + name);
  });
  element.addClass('effects-' + name);
}
