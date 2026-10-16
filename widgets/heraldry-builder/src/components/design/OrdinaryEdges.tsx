// "More shapes and edges…" under a band or shape (and "Edge…" on a top band or border): its shape — upside down, shortened, touching the
// edges, hollow, raised or lowered, where it takes them — the line its edges are drawn with, and for a band with two edges, which of them carries
// it, and for a central band or shape its outline (edged or cotised). Shown once the band is chosen. The band step puts these controls in
// its own disclosure, under its "More shapes" row (`OrdinaryShapeControls`).

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

interface ControlsProps {
  design: Design;
  path: GroupPath;
  /** The toggles are <testid>-shape-… and <testid>-position-…, the options <testid>-edge-…. */
  testid: string;
  noun: string;
  shape: FieldShape;
  onChange: (nd: Design) => void;
}

interface Props extends ControlsProps {
  /** The disclosure is <testid>-shape-more. */
  summary: string;
}

/** Whether the band or shape at `path` takes any shape, edge or outline control. */
export function hasShapeControls(design: Design, path: GroupPath): boolean {
  const target = { k: 'group', path } as const;
  return groupAt(design, path).item.k === 'ordinary'
    && (lineChoices(design, target).length > 0 || toggleChoices(design, path).length > 0 || bandPositionChoices(design, path).length > 0 || outlineChoices(design, path).length > 0);
}

/** Whether the band or shape at `path` uses one of them: a line, a treatment or an outline. */
export function usesShapeControls(design: Design, path: GroupPath): boolean {
  const item = groupAt(design, path).item;
  return item.k === 'ordinary' && (item.lines.a !== 'plain' || item.lines.b !== 'plain' || item.mods.length > 0 || outlineAt(design, path) !== 'none');
}

/** The shape toggles, edge row and outline of the band or shape at `path`, those it takes. */
export function OrdinaryShapeControls({ design, path, testid, noun, shape, onChange }: ControlsProps) {
  const target = { k: 'group', path } as const;
  const item = groupAt(design, path).item;
  if (item.k !== 'ordinary') return null;
  const lines = lineChoices(design, target);
  const toggles = toggleChoices(design, path);
  const positions = bandPositionChoices(design, path);
  const outlines = outlineChoices(design, path);
  const type = item.type;
  const inverted = item.mods.includes('inverted');
  // The edge previews are drawn turned as the band or shape is: upside down, or in the other corner.
  const turned = item.mods.filter((m) => m === 'inverted' || m === 'sinister');
  const current: Line = item.lines.a !== 'plain' ? item.lines.a : item.lines.b;
  const names = edgeNames({ k: 'ordinary', type, inverted });
  return (
    <>
      {(toggles.length > 0 || positions.length > 0) && (
        <ShapeToggles
          testid={testid} noun={noun} toggles={toggles} isOn={(t) => toggledOn(design, path, t)} onToggle={(t, on) => onChange(setOrdinaryToggle(design, path, t, on))}
          positions={positions} position={bandPositionOf(design, path)} onPosition={(p) => onChange(setOrdinaryBandPosition(design, path, p))}
        />
      )}
      {lines.length > 0 && (
        <EdgePicker
          testid={`${testid}-edge`} noun={noun} iconKey={[type, ...turned].join('-')}
          icon={(line) => ({ v: 2, field: 'azure', groups: [{ item: { k: 'ordinary', type, mods: turned, lines: bareLines({ k: 'ordinary', type, inverted }, line) }, paint: 'or' }] })}
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
  );
}

export function OrdinaryEdges({ summary, ...controls }: Props) {
  if (!hasShapeControls(controls.design, controls.path)) return null;
  return (
    <MoreShapes testid={controls.testid} summary={summary} used={usesShapeControls(controls.design, controls.path)}>
      {() => <OrdinaryShapeControls {...controls} />}
    </MoreShapes>
  );
}
