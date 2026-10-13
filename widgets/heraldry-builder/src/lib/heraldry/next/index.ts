// Barrel of the new library as it grows; the SPA and the Worker move over to it when it is complete.

export { POSTURES, POSTURE_GLOSS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, CHARGES, isChargeId, postureTerm, postureGloss, chargesInCategory, type Posture, type ChargeCategory, type ChargeId } from './charges';
export { ORDINARY_TYPES, DRAWN_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType, type Line } from './ordinaries';
export { DIVISIONS, DRAWN_DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, partCount, type Division } from './divisions';
export {
  canonical, canonicalJson, replaceGroup, fieldTinctures, groupAt, hostOf, walkGroups, pathKey, primaryGroup, isFieldPrimary, tincturePaint, paintOfGroupTincture, groupTinctureOf,
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
export { contrastFailure, type ContrastFailure } from './contrast';
export { FAILURE_TEXT, tinctureIssues, groundContacts, counterchangeUnavailable, describeSlots } from './tincture-rule';
export { validate, normalise, type NormaliseResult } from './validate';
export { blazon } from './blazon';
export { gloss, betweenWords } from './gloss';
export {
  DIVISION_LABEL, ORDINARY_LABEL, LAYOUT_LABEL, TINCTURE_LABEL, plainFirst, layoutLabel, chargeLabel, chargeWords, ordinaryWords, postureLabel, groupLabel,
  type PlainTerm,
} from './plain-words';
export { readability, BAND_LABEL, BAND_RANGE, isReadabilityBand, type Readability, type ReadabilityBand } from './readability';
export { deriveTags, filtersToTags, matchesTags, NO_FILTERS, type SearchFilters } from './tags';
export { buildSearchText, normaliseWords, matchesWords, queryWords, type SearchWord } from './search-terms';
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
export {
  SENA_RULES, isDiffAttr, isChangeKind, isSenaRule, isClear, differences, checkUnique, candidateKey, explainDifferences, changeLabel, tallyText,
  CLEAR_CHANGE_HINT, SENA_RULE_HINT,
  type ChangeKind, type SenaRule, type DiffAttr, type GroupRef, type Diff, type RegistryEntryLike, type Comparison, type Verdict, type CandidateKey, type DifferenceNote,
} from './difference';
export {
  registrationOrder, reportUniqueness, checkResponse,
  type RegistryRef, type CheckableEntry, type ConflictSummary, type ComparedEntry, type UniquenessReport, type TakenReport, type CheckResponse,
} from './check';
export {
  FILTER_PARAMS, NO_SEARCH_PARAMS, parseSearchParams, searchParamsFromUrl, searchParamsToUrl, searchEntries,
  type SearchParams, type SearchableEntry,
} from './search';
