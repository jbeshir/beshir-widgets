// "More shapes and edges…" under a band or shape (and "Edge…" on a top band or border): its shape — upside down, shortened, touching the
// edges, hollow, raised or lowered, where it takes them — the line its edges are drawn with, and for a band with two edges, which of them carries
// it, and for a central band or shape its outline (edged or cotised). Shown once the band is chosen.

import {
  bandPositionChoices, bandPositionOf, bareLines, edgeNames, edgeSideChoices, edgeSideOf, groupAt, lineChoices, outlineAt, outlineChoices, outlineTinctureChoices, outlineTinctureOf,
  setOutlineTincture, toggleChoices, toggledOn,
  type Design, type EdgeSide, type FieldShape, type GroupPath, type Line,
} from '../../lib/heraldry';
import { setCotiseLine, setOrdinaryBandPosition, setOrdinaryEdgeSide, setOrdinaryLine, setOrdinaryOutline, setOrdinaryToggle } from '../../lib/builder';
import { EdgePicker } from './EdgePicker';
import { MoreShapes } from './MoreShapes';
import { OutlineControls } from './OutlineControls';
import { ShapeToggles } from './ShapeToggles';

/** What each side of a band's edges is called: a pale's are its left and right edges, any other band's its top and bottom. */
function sideLabels(across: boolean): Record<EdgeSide, string> {
  return { both: 'Both edges', a: across ? 'Left edge only' : 'Top edge only', b: across ? 'Right edge only' : 'Bottom edge only' };
}

interface Props {
  design: Design;
  path: GroupPath;
  /** The disclosure is <testid>-shape-more, the toggles <testid>-shape-… and <testid>-position-…, the options <testid>-edge-…. */
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
  const toggles = toggleChoices(design, path);
  const positions = bandPositionChoices(design, path);
  const outlines = outlineChoices(design, path);
  if (item.k !== 'ordinary' || (lines.length === 0 && toggles.length === 0 && positions.length === 0 && outlines.length === 0)) return null;
  const type = item.type;
  const inverted = item.mods.includes('inverted');
  const current: Line = item.lines.a !== 'plain' ? item.lines.a : item.lines.b;
  const names = edgeNames({ k: 'ordinary', type, inverted });
  return (
    <MoreShapes testid={testid} summary={summary} used={current !== 'plain' || item.mods.length > 0 || outlineAt(design, path) !== 'none'}>
      {() => (
        <>
          {(toggles.length > 0 || positions.length > 0) && (
            <ShapeToggles
              testid={testid} noun={noun} toggles={toggles} isOn={(t) => toggledOn(design, path, t)} onToggle={(t, on) => onChange(setOrdinaryToggle(design, path, t, on))}
              positions={positions} position={bandPositionOf(design, path)} onPosition={(p) => onChange(setOrdinaryBandPosition(design, path, p))}
            />
          )}
          {lines.length > 0 && (
            <EdgePicker
              testid={`${testid}-edge`} noun={noun} iconKey={`${type}${inverted ? '-inverted' : ''}`}
              icon={(line) => ({ v: 2, field: 'azure', groups: [{ item: { k: 'ordinary', type, mods: inverted ? ['inverted'] : [], lines: bareLines({ k: 'ordinary', type, inverted }, line) }, paint: 'or' }] })}
              shape={shape} lines={lines} line={current} onLine={(l) => onChange(setOrdinaryLine(design, path, l))}
              sides={edgeSideChoices(design, target)} side={edgeSideOf(design, target)} sideNoun="edges" sideLabels={sideLabels(names?.a === 'dexter')}
              onSide={(s) => onChange(setOrdinaryEdgeSide(design, path, s))}
            />
          )}
          {outlines.length > 0 && (
            <OutlineControls
              testid={testid} noun={noun} outlines={outlines} outline={outlineAt(design, path)} onOutline={(o) => onChange(setOrdinaryOutline(design, path, o))}
              tinctures={outlineTinctureChoices(design, path)} tincture={outlineTinctureOf(design, path)} onTincture={(t) => onChange(setOutlineTincture(design, path, t))}
              cotiseLines={lineChoices(design, { k: 'cotises', path })} cotiseLine={item.cotised?.line ?? 'plain'} onCotiseLine={(l) => onChange(setCotiseLine(design, path, l))}
            />
          )}
        </>
      )}
    </MoreShapes>
  );
}
