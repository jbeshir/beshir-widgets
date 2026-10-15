// Barrel of the heraldry library: everything the SPA and the Worker use.

export { POSTURES, POSTURE_GLOSS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, CHARGES, TYPE_CLASSES, isChargeId, postureTerm, postureGloss, chargesInCategory, type Posture, type ChargeCategory, type ChargeId, type ModifierId, type TypeClass } from './charges';
export { ORDINARY_TYPES, DRAWN_ORDINARIES, OVERALL_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType, type Line } from './ordinaries';
export { DIVISIONS, DRAWN_DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, partCount, type Division } from './divisions';
export {
  canonical, canonicalJson, replaceGroup, PLAIN_LINES, fieldTinctures, groupAt, hostOf, walkGroups, pathKey, primaryGroup, isFieldPrimary, tincturePaint, paintOfGroupTincture, groupTinctureOf, GROUP_TINCTURES, isGroupTincture,
  UNSUPPORTED_GAP_CATEGORIES,
  type Design, type Group, type GroupPath, type GroupTincture, type Paint, type Item, type Issue, type UnsupportedIssue, type Gap, type GapCategory, type IssueAt,
} from './design';
export { resolve, type ResolveResult } from './resolve';
export { unsupportedIssues, isSupported, notSupported, UnsupportedConstructError, MAX_DRAWN_COUNT } from './support';
export { structuralIssues } from './structure';
export {
  ROW_PATTERNS, layoutKey, layoutOfKey, layoutContext, layoutCandidates, tableDefault, defaultLayout, isForced, statesLayout,
  hostCounts, ON_CHARGE_COUNTS, onChargeLayouts, betweenWords, layoutWords, fieldContext, hasChief, hasBordure, SECONDARY_POSITIONS, AROUND_COUNTS, aroundLayouts, aroundPrimaryLayouts, primaryCharges,
  type FieldContext, type GroundContext, type HostCharges, type Layout, type LayoutKey, type LayoutContext, type Peripheral, type Yield, type Share, type SecondaryPosition,
} from './arrangement';
export { GROUND_CLASS_SHARE, contrastFailure, groundFailure, groundTinctures, type ContrastFailure, type Ground, type GroundShare } from './contrast';
export {
  FAILURE_TEXT, tinctureIssues, groupTinctureIssues, groundShares, groundContacts, shownTinctures, counterchangeUnavailable, describeSlots, type ShownTinctures,
} from './tincture-rule';
export { validate, normalise, type NormaliseResult } from './validate';
export { blazon, type BlazonOptions } from './blazon';
export { gloss } from './gloss';
export {
  DIVISION_LABEL, ORDINARY_LABEL, PLACE_LABEL, TINCTURE_LABEL, plainFirst, layoutLabel, chargeLabel, chargeWords, ordinaryWords, postureLabel, groupLabel,
  type PlainTerm,
} from './plain-words';
export { readability, BAND_LABEL, BAND_RANGE, isReadabilityBand, type Readability, type ReadabilityBand } from './readability';
export { deriveTags, filtersToTags, matchesTags, NO_FILTERS, type SearchFilters } from './tags';
export { buildSearchText, normaliseWords, matchesWords, queryWords, type SearchWord } from './search-terms';
export { signature } from './signature';
export {
  SHIELD_VIEWBOX, SHIELD_PATH, fieldRegions, fieldTinctureAt, inFirstPart, ordinaryPath, ordinaryFillRule, ordinarySamplePoints,
  drawnBox, slotTransform, probePoints, groundPoints, slotRow, slotColumn, shapeFrame, pathPolygon, pointInPolygon,
  counterchangedSlotParts, counterchangedOrdinaryParts, type Slot,
} from './geometry';
export { MIN_SLOT_SIZE, minSlotSize, slotCount, groupSlotCount, hasRoom, contextSlots, groupSlots, canonicalSlots, capacityIssue, largestFittingCount } from './layout';
export { PLACE_KEYS, placesOf, placesIn, pathOfPlace, placeOfPath, type PlaceKey, type Placed } from './places';
export {
  LAYER_KEYS, layerPath, layersIn, layerChoices, addLayer, removeLayer, setLayerCharge, setLayerItem, layerItemChoices, setLayerTincture, refitLayers, ordinaryGroup, chargeItem, newCharge,
  type LayerItem, type LayerKey, type PeripheralKey, type PicturesKey, type PositionedKey,
} from './layers';
export {
  COUNTS, isBlocked, firstAllowed, isAllowed, simpleParts, partsOf, assembleParts, withTincture, fieldTinctureChoices, groupTinctureChoices, countChoices, placementChoices, layoutChoices,
  layoutReason, withLayout, postureChoices, modifierChoices, fitGroup, suggestTinctureFix,
  type Choice, type AllowedChoice, type BlockedChoice, type LayoutChoice, type LayoutChoices, type Placement, type Companion, type SimpleParts, type PartsInput, type TinctureFix,
} from './options';
export { renderLayers, designTinctures, type Layer } from './render';
export { CHARGE_ART, MODIFIER_ART, ART_ON_BOX, chargePath, chargeOnBox, type ArtBox } from './charge-art';
export { FIELD_SHAPES, DEFAULT_FIELD_SHAPE, FIELD_SHAPE_NAME, isFieldShape, type FieldShape, type ShapedDesign } from './shape';
export * from './tinctures';
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
export { API_ERROR, isApiErrorCode, type ApiErrorCode, type TokenProblem } from './api-errors';
export { NO_CONTACT, DISCORD_MAX, cleanDiscord, cleanContact, type Contact } from './contact';
export { EMAIL_MAX, cleanEmail, isMailOutcome, type MailOutcome } from './email';
export { asObject } from './json';
export { DISPLAY_NAME_MAX, cleanDisplayName } from './text';
