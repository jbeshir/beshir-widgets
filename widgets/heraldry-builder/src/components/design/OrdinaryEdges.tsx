// "More shapes and edges…" under a band or shape (and "Edge…" on a top band or border): its shape — upside down, shortened, touching the
// edges, hollow, raised or lowered, double or triple, where it takes them — the line its edges are drawn with, and for a band with two edges, which of them carries
// it, and for a central band or shape its outline (edged or cotised). Shown once the band is chosen. The band step puts these controls in
// its own disclosure, under its "More shapes" row (`OrdinaryShapeControls`).

import {
  bandPositionChoices, bandPositionOf, bareLines, edgeNames, edgeSideChoices, edgeSideOf, groupAt, lineChoices, ordinaryCountChoices, ordinaryCountLabel, ordinaryCountLegend, ordinaryEdgeHost, outlineAt, outlineChoices, outlineTinctureChoices,
  outlineTinctureOf, setOutlineTincture, toggleChoices, toggledOn, familyOf, THIN_ORDINARIES,
  type Design, type OrdinaryType, type EdgeName, type EdgeSide, type FieldShape, type GroupPath, type Line,
} from '../../lib/heraldry';
import { setCotiseLine, setOrdinaryBandPosition, setOrdinaryEdgeSide, setOrdinaryLine, setOrdinaryNumber, setOrdinaryOutline, setOrdinaryToggle } from '../../lib/builder';
import { EdgePicker } from './EdgePicker';

/** The bands and shapes whose lines run through the middle of the field, where the edge chips zoom in (`EdgePicker`'s `zoom`); a chief, bordure, canton … lies at its edge. */
const THROUGH_THE_MIDDLE: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pall', 'pall-inverted', 'pile'];
import { MoreShapes } from './MoreShapes';
import { OutlineControls } from './OutlineControls';
import { ShapeToggles } from './ShapeToggles';

/** What each side of a band's edges is called: a pale's are its left and right edges, an orle's its outer and inner, any other band's its top and bottom. */
function sideLabels(a: EdgeName | undefined): Record<EdgeSide, string> {
  const [one, other] = a === 'dexter' ? ['Left', 'Right'] : a === 'outer' ? ['Outer', 'Inner'] : ['Top', 'Bottom'];
  return { both: 'Both edges', a: `${one} edge only`, b: `${other} edge only` };
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
    && (lineChoices(design, target).length > 0 || toggleChoices(design, path).length > 0 || bandPositionChoices(design, path).length > 0 || outlineChoices(design, path).length > 0
      || ordinaryCountChoices(design, path).length > 0);
}

/** Whether the band or shape at `path` uses one of them: a line, a treatment, an outline, or thin bands. */
export function usesShapeControls(design: Design, path: GroupPath): boolean {
  const item = groupAt(design, path).item;
  return item.k === 'ordinary' && (item.lines.a !== 'plain' || item.lines.b !== 'plain' || item.mods.length > 0 || outlineAt(design, path) !== 'none' || THIN_ORDINARIES.includes(item.type));
}

/** The shape toggles, edge row and outline of the band or shape at `path`, those it takes. */
export function OrdinaryShapeControls({ design, path, testid, noun, shape, onChange }: ControlsProps) {
  const target = { k: 'group', path } as const;
  const { item, count } = groupAt(design, path);
  if (item.k !== 'ordinary') return null;
  const lines = lineChoices(design, target);
  const toggles = toggleChoices(design, path);
  const positions = bandPositionChoices(design, path);
  const outlines = outlineChoices(design, path);
  const counts = ordinaryCountChoices(design, path);
  const type = item.type;
  // The edge previews are drawn turned as the band or shape is: upside down, or in the other corner.
  const turned = item.mods.filter((m) => m === 'inverted' || m === 'sinister');
  const current: Line = item.lines.a !== 'plain' ? item.lines.a : item.lines.b;
  const host = ordinaryEdgeHost(item);
  const names = edgeNames(host);
  return (
    <>
      {(toggles.length > 0 || positions.length > 0 || counts.length > 0) && (
        <ShapeToggles
          testid={testid} noun={noun} toggles={toggles} isOn={(t) => toggledOn(design, path, t)} onToggle={(t, on) => onChange(setOrdinaryToggle(design, path, t, on))}
          positions={positions} position={bandPositionOf(design, path)} onPosition={(p) => onChange(setOrdinaryBandPosition(design, path, p))}
          counts={counts} count={count} countLegend={ordinaryCountLegend(type)} countLabel={(n) => ordinaryCountLabel(type, n)} onCount={(n) => onChange(setOrdinaryNumber(design, path, n))}
        />
      )}
      {lines.length > 0 && (
        <EdgePicker
          testid={`${testid}-edge`} noun={noun} iconKey={[type, ...turned, ...(count > 1 ? [count] : [])].join('-')} zoom={THROUGH_THE_MIDDLE.includes(familyOf(type))}
          icon={(line) => ({ v: 2, field: 'azure', groups: [{ item: { k: 'ordinary', type, mods: turned, lines: bareLines(host, line) }, count, paint: 'or' }] })}
          shape={shape} lines={lines} line={current} onLine={(l) => onChange(setOrdinaryLine(design, path, l))}
          sides={edgeSideChoices(design, target)} side={edgeSideOf(design, target)} sideNoun="edges" sideLabels={sideLabels(names?.a)}
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
