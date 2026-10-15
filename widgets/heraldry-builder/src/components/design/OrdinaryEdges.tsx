// "More shapes and edges…" under a band or shape (and "Edge…" on a top band or border): the line its edges are drawn with, and for a
// band with two edges, which of them carries it. Shown once the band is chosen.

import { bareLines, edgeNames, edgeSideChoices, edgeSideOf, groupAt, lineChoices, type Design, type EdgeSide, type FieldShape, type GroupPath, type Line } from '../../lib/heraldry';
import { setOrdinaryEdgeSide, setOrdinaryLine } from '../../lib/builder';
import { EdgePicker } from './EdgePicker';
import { MoreShapes } from './MoreShapes';

/** What each side of a band's edges is called: a pale's are its left and right edges, any other band's its top and bottom. */
function sideLabels(across: boolean): Record<EdgeSide, string> {
  return { both: 'Both edges', a: across ? 'Left edge only' : 'Top edge only', b: across ? 'Right edge only' : 'Bottom edge only' };
}

interface Props {
  design: Design;
  path: GroupPath;
  /** The disclosure is <testid>-shape-more and the options <testid>-edge-…. */
  testid: string;
  summary: string;
  noun: string;
  shape: FieldShape;
  onChange: (nd: Design) => void;
}

export function OrdinaryEdges({ design, path, testid, summary, noun, shape, onChange }: Props) {
  const target = { k: 'group', path } as const;
  const item = groupAt(design, path).item;
  const lines = lineChoices(design, target);
  if (item.k !== 'ordinary' || lines.length === 0) return null;
  const type = item.type;
  const current: Line = item.lines.a !== 'plain' ? item.lines.a : item.lines.b;
  const names = edgeNames({ k: 'ordinary', type, inverted: item.mods.includes('inverted') });
  return (
    <MoreShapes testid={testid} summary={summary} used={current !== 'plain'}>
      {() => (
        <EdgePicker
          testid={`${testid}-edge`} noun={noun} iconKey={type}
          icon={(line) => ({ v: 2, field: 'azure', groups: [{ item: { k: 'ordinary', type, lines: bareLines({ k: 'ordinary', type, inverted: false }, line) }, paint: 'or' }] })}
          shape={shape} lines={lines} line={current} onLine={(l) => onChange(setOrdinaryLine(design, path, l))}
          sides={edgeSideChoices(design, target)} side={edgeSideOf(design, target)} sideNoun="edges" sideLabels={sideLabels(names?.a === 'dexter')}
          onSide={(s) => onChange(setOrdinaryEdgeSide(design, path, s))}
        />
      )}
    </MoreShapes>
  );
}
