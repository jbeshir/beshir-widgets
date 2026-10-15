// Barrel of the heraldry library: everything the SPA and the Worker use.

export { POSTURES, POSTURE_GLOSS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, CHARGES, TYPE_CLASSES, isChargeId, postureTerm, postureGloss, chargesInCategory, type Posture, type ChargeCategory, type ChargeId, type ModifierId, type TypeClass } from './charges';
export { NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, semyPhrase } from './aliases';
export { STREWN_COUNT, liftStrewn, strewnGroups, strewnIssues, type Strewn } from './strewn';
export { ORDINARY_TYPES, DRAWN_ORDINARIES, OVERALL_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType, type Line } from './ordinaries';
export { DIVISIONS, DRAWN_DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, DRAWN_TREATMENTS, TREATMENTS, VARIATIONS, VARIATION_NAME, VARIATION_PIECES, VARIATION_SPELLINGS, DEFAULT_PIECES, isCountedVariation, partCount, type Division, type Treatment, type Variation } from './divisions';
export {
  canonical, canonicalJson, replaceGroup, PLAIN_LINES, fieldTinctures, fieldParts, paintTinctures, bodyTinctures, groupAt, hostOf, walkGroups, groundTincture, pathKey, primaryGroup, primaryGroups, isFieldPrimary, tincturePaint, partyPaint, asParty, variationPaint, asVariation, treatedPaint, asTreated, semyPaint, asSemy, fieldSemys, paintOfGroupTincture, groupTinctureOf, GROUP_TINCTURES, isGroupTincture,
  UNSUPPORTED_GAP_CATEGORIES,
  type Design, type Group, type GroupPath, type GroupTincture, type Paint, type PartyPaint, type TreatedPaint, type SemyPaint, type VariationPaint, type Item, type Issue, type UnsupportedIssue, type Gap, type GapCategory, type CountLimit, type IssueAt,
} from './design';
export { resolve, type ResolveResult } from './resolve';
export { unsupportedIssues, isSupported, notSupported, UnsupportedConstructError, MAX_DRAWN_COUNT } from './support';
export { structuralIssues } from './structure';
export {
  ROW_PATTERNS, layoutKey, layoutOfKey, layoutContext, layoutCandidates, tableDefault, defaultLayout, isForced, forcedPosition, statesLayout, HALF_POSITIONS,
  hostCounts, ON_CHARGE_COUNTS, onChargeLayouts, betweenWords, layoutWords, fieldContext, hasChief, hasBordure, SECONDARY_POSITIONS, AROUND_COUNTS, aroundLayouts, aroundPrimaryLayouts, primaryCharges, coPrimaries, MAX_CO_PRIMARY_TOTAL, shareTotal,
  type FieldContext, type GroundContext, type HalfPosition, type HostCharges, type Layout, type LayoutKey, type LayoutContext, type Peripheral, type Yield, type Share, type SecondaryPosition,
} from './arrangement';
export { GROUND_CLASS_SHARE, contrastFailure, groundFailure, groundTinctures, type ContrastFailure, type Ground, type GroundShare } from './contrast';
export { tinctureSurface, surfaceOf, fieldSurfaces, sharesTincture, sameSurface, type Surface, type ContrastClass, type BaseTincture } from './surface';
export {
  FAILURE_TEXT, tinctureIssues, groupTinctureIssues, groundShares, groundContacts, shownSurfaces, counterchangeUnavailable, describeSlots, type ShownSurfaces,
} from './tincture-rule';
export { validate, normalise, type NormaliseResult } from './validate';
export { blazon, type BlazonOptions } from './blazon';
export { gloss } from './gloss';
export {
  DIVISION_LABEL, FUR_LABEL, TREATMENT_LABEL, VARIATION_LABEL, ORDINARY_LABEL, PLACE_LABEL, TINCTURE_LABEL, plainFirst, layoutLabel, chargeLabel, chargeWords, ordinaryWords, postureLabel, groupLabel,
  type PlainTerm,
} from './plain-words';
export { readability, BAND_LABEL, BAND_RANGE, isReadabilityBand, type Readability, type ReadabilityBand } from './readability';
export { deriveTags, filtersToTags, matchesTags, NO_FILTERS, type SearchFilters } from './tags';
export { buildSearchText, normaliseWords, matchesWords, queryWords, type SearchWord } from './search-terms';
export { signature } from './signature';
export {
  SHIELD_VIEWBOX, SHIELD_PATH, fieldRegions, fieldSurfaceAt, inFirstPart, ordinaryPath, ordinaryFillRule, ordinarySamplePoints,
  drawnBox, slotTransform, probePoints, groundPoints, slotRow, slotColumn, shapeFrame, pathPolygon, pathRings, pointInPolygon,
  counterchangedSlotParts, counterchangedOrdinaryParts, ordinaryBox, type Slot,
} from './geometry';
export { variationRegions, inFirstRegion, type Box } from './variation-geometry';
export { MIN_SLOT_SIZE, minSlotSize, groupSlotCount, hasRoom, contextSlots, groupSlots, canonicalSlots, capacityIssue } from './layout';
export { PLACE_KEYS, placesOf, placesIn, pathOfPlace, placeOfPath, type PlaceKey, type Placed } from './places';
export {
  LAYER_KEYS, layersIn, layerChoices, addLayer, removeLayer, setLayerCharge, setOverallItem, overallItemChoices, setLayerTincture, refitLayers, ordinaryGroup, chargeItem, newCharge,
  type LayerItem, type LayerKey, type PeripheralKey, type PicturesKey,
} from './layers';
export {
  COUNTS, isBlocked, firstAllowed, isAllowed, simpleParts, partsOf, assembleParts, withTincture, fieldTinctureChoices, groupTinctureChoices, countChoices, placementChoices, layoutChoices,
  layoutReason, withLayout, postureChoices, modifierChoices, fitGroup, suggestTinctureFix,
  partyDivisionChoices, partyTinctureChoices, groupVariationChoices, setGroupVariation, setGroupVariationPieces, groupVariationTinctureChoices, setGroupVariationTincture, setPartyDivision, setPartyTincture, splitGroup, joinGroup,
  type Choice, type AllowedChoice, type BlockedChoice, type LayoutChoice, type LayoutChoices, type Placement, type Companion, type SimpleParts, type PartsInput, type TinctureFix,
} from './options';
export { FUR_KINDS, furColours, furKindOf, furOfKind, furName, furGloss, takesColours, type FurKind, type FurPaint } from './fur';
export { furChoices, furColourChoices, furAt, setFur, setFurColour } from './fur-options';
export { paintAt, type PaintTarget } from './paint-target';
export { treatmentAt, treatmentChoices, setTreatment, treatmentColourChoices, setTreatmentColour } from './treatment-options';
export { semyAt, semyChoices, setSemy, clearSemy, semyColourChoices, setSemyColour } from './semy-options';
export { treatedName, treatedGloss } from './treatment';
export { hasNaturalColours, properChoice, setProper } from './proper-options';
export { furPattern, treatmentPattern, colourHex, ERMINE_SPOT } from './patterns';
export { renderLayers, badgeView, designTinctures, type Layer } from './render';
export { fillCode, fillHatchTinctures, hatchTincture, solidFill, type Fill, type LeafFill, type SlotFill } from './paint-render';
export type { PatternSpec, SolidColour } from './patterns';
export { CHARGE_ART, MODIFIER_ART, ART_ON_BOX, chargePath, chargeOnBox, type ArtBox } from './charge-art';
export { FIELD_SHAPES, DEFAULT_FIELD_SHAPE, FIELD_SHAPE_NAME, isFieldShape, type FieldShape, type ShapedDesign } from './shape';
export * from './tinctures';
export {
  SENA_RULES, isDiffAttr, isChangeKind, isSenaRule, isClear, differences, checkUnique, candidateKey, keysMayConflict, MIXED_PRIMARY, explainDifferences, changeLabel, tallyText,
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
