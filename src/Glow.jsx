import React from 'react';
// A glow without any SVG filter (a blur is clipped to the shape's box and looks cut off): stacked, widening, nearly
// transparent strokes add up to a soft gradient that is brightest on the edge and fades outward.
const OUT = Array.from({ length: 10 }, (_, i) => 6 + i * 4.5);   // outer halo widths in px (half of each shows outside the edge)
const IN = Array.from({ length: 7 }, (_, i) => 10 + i * 9);      // inner haze, drawn inside the shape only
export function Halo({ d, strong = 1 }) {
  return <g className="halo" style={{ opacity: strong }}>{OUT.map(w => <path key={w} d={d} fillRule="evenodd" style={{ strokeWidth: w }}/>)}</g>;
}
export function InnerHaze({ d }) {
  return <g className="haze">{IN.map(w => <path key={w} d={d} fillRule="evenodd" style={{ strokeWidth: w }}/>)}</g>;
}
