// Contours: closed outlines made of edges, each straight, curved through flattened points, or drawn with a
// line of partition. What partition regions, ordinaries and their parts are built from. Pure — no DOM.

import { r2, type Pt } from './geometry';
import { edgeCommands, polylineEdgeCommands, type EdgeRun } from './lines';

/**
 * An edge from the previous vertex through `via` to `to`: `via` is [] for a straight edge, or the flattened points of a curved base
 * line (a bordure's inset, a round shape's arc). `run` null = drawn plain.
 */
export interface ContourEdge { readonly via: readonly Pt[]; readonly to: Pt; readonly run: EdgeRun | null }

/** A closed outline; the closing edge back to `start` is straight (give it as an edge when it carries a line). */
export interface Contour { readonly start: Pt; readonly edges: readonly ContourEdge[] }

const point = ([x, y]: Pt) => `${r2(x)} ${r2(y)}`;

/** `M…Z`. With every run null and no `via`, the string is exactly what `pts([start, ...tos])` gives. */
export function contourPath(c: Contour): string {
  let d = `M${point(c.start)}`;
  let at = c.start;
  for (const e of c.edges) {
    if (e.run === null) d += [...e.via, e.to].map((p) => `L${point(p)}`).join('');
    else d += e.via.length === 0 ? edgeCommands(at, e.to, e.run) : polylineEdgeCommands([at, ...e.via, e.to], e.run);
    at = e.to;
  }
  return `${d}Z`;
}

/** Several contours as subpaths of one path (the caller picks the fill rule). */
export function contoursPath(cs: readonly Contour[]): string {
  return cs.map(contourPath).join('');
}
