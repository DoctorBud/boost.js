// =============================================================================
// Boost.js | Draggable Component
// (c) Mathigon
// =============================================================================


import { Evented, applyDefaults } from '@mathigon/core';
import { Point } from '@mathigon/fermat';
import { Browser } from './browser';
import { slide } from './events';


const defaultOptions = {
  moveX: true,
  moveY: true,
  snap: 1,
  useTransform: false,
  margin: 0,
  round: (p => p),
  responsive: false  // TODO This should be the default for SVG elements.
};

export class Draggable extends Evented {

  constructor($el, $parent, options={}) {
    super();

    this.$el = $el;
    this.position = new Point(0, 0);
    this.options = applyDefaults(options, defaultOptions);
    this.disabled = false;

    this.width  = this.options.responsive ? $parent.svgWidth : $parent.width;
    this.height = this.options.responsive ? $parent.svgHeight : $parent.height;

    let startPosn = null;
    slide($el, {
      start: () => {
        if (this.disabled) return;
        startPosn = this.position;
        this.trigger('start');
      },
      move: (posn, start) => {
        if (this.disabled) return;
        this.setPosition(startPosn.x + posn.x - start.x,
            startPosn.y + posn.y - start.y);
        this.trigger('drag', this.position);
      },
      end: (last, start) => {
        if (this.disabled) return;
        this.trigger(last.equals(start) ? 'click' : 'end');
      }
    });

    Browser.resize(() => {
      const oldWidth = this.width;
      const oldHeight = this.height;

      this.width  = this.options.responsive ? $parent.svgWidth : $parent.width;
      this.height = this.options.responsive ? $parent.svgHeight : $parent.height;

      this.setPosition(this.position.x * this.width  / oldWidth || 0,
          this.position.y * this.height / oldHeight || 0);
    });
  }

  setPosition(x, y) {
    const m = this.options.margin;
    const p = this.options.round(new Point(x, y)
        .clamp(m, this.width - m, m, this.height - m)
        .round(this.options.snap));

    if (!this.options.moveX) p.x = 0;
    if (!this.options.moveY) p.y = 0;

    if (p.equals(this.position)) return;
    this.position = p;

    if (this.options.useTransform) {
      this.$el.translate(p.x, p.y);
    } else {
      if (this.options.moveX) this.$el.css('left', p.x + 'px');
      if (this.options.moveY) this.$el.css('top', p.y + 'px');
    }

    this.trigger('move', p);
  }

}
