// Barrel of the new library as it grows; the SPA and the Worker move over to it when it is complete.

export { POSTURES, POSTURE_GLOSS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, CHARGES, isChargeId, postureTerm, postureGloss, chargesInCategory, type Posture, type ChargeCategory, type ChargeId } from './charges';
export { ORDINARY_TYPES, DRAWN_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType, type Line } from './ordinaries';
export { DIVISIONS, DRAWN_DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, partCount, type Division } from './divisions';
export {
  canonical, canonicalJson, groupAt, hostOf, walkGroups, pathKey, primaryGroup, isFieldPrimary, tincturePaint, paintOfGroupTincture, groupTinctureOf,
  UNSUPPORTED_GAP_CATEGORIES,
  type Design, type Group, type GroupPath, type GroupTincture, type Paint, type Item, type Issue, type UnsupportedIssue, type Gap, type GapCategory, type IssueAt,
} from './design';
export { resolve, type ResolveResult } from './resolve';
export { unsupportedIssues, isSupported, notSupported, UnsupportedConstructError, MAX_DRAWN_COUNT } from './support';
export { structuralIssues } from './structure';
export {
  ROW_PATTERNS, layoutKey, layoutOfKey, layoutContext, layoutCandidates, tableDefault, defaultLayout, isForced, statesLayout,
  hostCounts, layoutWords, type Layout, type LayoutKey, type LayoutContext,
} from './arrangement';
export { contrastFailure, type ContrastFailure } from './tincture-rule';
export { signature } from './signature';
export {
  SHIELD_VIEWBOX, SHIELD_PATH, fieldRegions, fieldTinctureAt, inFirstPart, ordinaryPath, ordinaryFillRule, ordinarySamplePoints,
  drawnBox, slotTransform, probePoints, slotContacts, slotRow, slotColumn, shapeFrame, pathPolygon, pointInPolygon,
  counterchangedSlotParts, counterchangedOrdinaryParts, type Slot,
} from './geometry';
export { MIN_SLOT_SIZE, contextSlots, groupSlots, canonicalSlots, capacityIssue, largestFittingCount } from './layout';
export { renderLayers, designTinctures, type Layer } from './render';
export { CHARGE_ART, MODIFIER_ART, chargePath } from './charge-art';
export { FIELD_SHAPES, DEFAULT_FIELD_SHAPE, FIELD_SHAPE_NAME, isFieldShape, type FieldShape, type ShapedDesign } from './shape';
export * from '../tinctures';
