// Barrel of the heraldry library: everything the SPA and the Worker use.

export { POSTURES, POSTURE_GLOSS, FACINGS, GAZES, ORIENTATIONS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, POPULAR_CHARGE_IDS, CHARGES, TYPE_CLASSES, isChargeId, postureTerm, postureGloss, chargesInCategory, type Posture, type Facing, type Gaze, type Orientation, type ChargeCategory, type ChargeId, type ModifierId, type TypeClass } from './charges';
export { NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, semyPhrase } from './aliases';
export { STREWN_COUNT, liftStrewn, strewnGroups, strewnIssues, type Strewn } from './strewn';
export {
  ORDINARY_TYPES, TILE_OF, BUILDER_ORDINARIES, MORE_ORDINARIES, THIN_ORDINARIES, REFUSED_ORDINARIES, DRAWN_ORDINARIES, THIN, DIMINUTIVE_COUNTS, ORDINARY_PLURAL, ORDINARY_SPELLINGS, familyOf, isDiminutive, OVERALL_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, ORDINARY_ARTICLE, ORDINARY_COUNTS, ORDINARY_COUNT_WORD, ORDINARY_MODS, MOD_HOSTS, SAME_ORDINARY, THROUGHOUT_ALREADY,
  PERIPHERAL_ORDER, PERIPHERAL_JOINER, modDrawn, isOrdinaryType, ordinaryWithArticle, type OrdinaryType, type OrdinaryMod, type PeripheralJoiner,
} from './ordinaries';
export {
  LINES, DRAWN_LINES, COMMON_LINES, LINE_GROUP, LINE_PROFILE, LINE_WORD, LINE_SPELLINGS, isLine, isStraightLine, ordinaryEdgeHost, lineDiffers, edgeCount, lineAllowed, bareLines, fitPeriod, visibleSpan, edgeCommands, polylineEdgeCommands, edgePoints, periodStarts,
  reversedRun, runAlong, fieldSide, laidSide, featureMiddle, profileSwing, profileSides, edgeNames, lineWords, COUNTER_EMBATTLED_WORDS,
  type Line, type ComplexLine, type LineGroup, type EdgeHost, type EdgeRun, type LaidLine, type EdgeName,
} from './lines';
export {
  lineChoices, setLine, edgeSideChoices, edgeSideOf, setEdgeSide, keptLines, keptOrdinaryLines, SHAPE_TOGGLES, toggleChoices, toggledOn, setToggle, bandPositionOf,
  bandPositionChoices, setBandPosition, keptMods, outlineAt, outlineChoices, setOutline, keptOutline, outlineTinctureOf, outlineTinctureChoices, setOutlineTincture, ordinaryCountChoices, setOrdinaryCount,
  type EdgeTarget, type EdgeSide, type ShapeToggle, type BandPosition,
} from './shape-options';
export { OUTLINES, type Outline } from './outline';
export { contourPath, contoursPath, type Contour, type ContourEdge } from './contour';
export { DIVISIONS, BUILDER_DIVISIONS, MORE_DIVISIONS, LINED_VARIATIONS, DRAWN_DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, GYRONNY_PIECES, DRAWN_TREATMENTS, TREATMENTS, VARIATIONS, VARIATION_NAME, VARIATION_PIECES, VARIATION_SPELLINGS, DEFAULT_PIECES, isCountedVariation, partCount, type Division, type Treatment, type Variation } from './divisions';
export {
  canonical, canonicalJson, canonicalLines, facingEachOther, replaceGroup, PLAIN_LINES, fieldTinctures, fieldParts, paintTinctures, bodyTinctures, groupAt, hostOf, walkGroups, groundTincture, pathKey, primaryGroup, primaryGroups, isFieldPrimary, tincturePaint, partyPaint, asParty, variationPaint, asVariation, treatedPaint, asTreated, semyPaint, asSemy, fieldSemys, paintOfGroupTincture, groupTinctureOf, GROUP_TINCTURES, isGroupTincture,
  UNSUPPORTED_GAP_CATEGORIES,
  type Design, type Group, type GroupPath, type GroupTincture, type Paint, type PartyPaint, type TreatedPaint, type SemyPaint, type VariationPaint, type Item, type Issue, type UnsupportedIssue, type Gap, type GapCategory, type CountLimit, type IssueAt, type TincturePart,
} from './design';
export { resolve, type ResolveResult } from './resolve';
export { unsupportedIssues, isSupported, notSupported, UnsupportedConstructError, MAX_DRAWN_COUNT } from './support';
export { structuralIssues, couldBeOneFess, coreSteps, COTISED_HOSTS } from './structure';
export {
  ROW_PATTERNS, layoutKey, layoutOfKey, layoutContext, layoutCandidates, tableDefault, defaultLayout, isForced, forcedPosition, statesLayout, HALF_POSITIONS, isHalfPosition,
  hostCounts, ON_CHARGE_COUNTS, onChargeLayouts, betweenWords, layoutWords, fieldContext, hasChief, hasBordure, hasChargedBordure, withoutChief, cornerBesideBend, SECONDARY_POSITIONS, AROUND_COUNTS, aroundLayouts, aroundPrimaryLayouts, primaryCharges, coPrimaries, MAX_CO_PRIMARY_TOTAL, shareTotal, mirroredSlots, drawnLayout, PAIRS,
  type FieldContext, type GroundContext, type HalfPosition, type QuarterPosition, type HostCharges, type KeepOut, type Layout, type LayoutKey, type LayoutContext, type Peripheral, type Yield, type Share, type SecondaryPosition,
} from './arrangement';
export { GROUND_CLASS_SHARE, contrastFailure, groundFailure, groundTinctures, type ContrastFailure, type Ground, type GroundShare } from './contrast';
export { tinctureSurface, surfaceOf, fieldSurfaces, sharesTincture, sameSurface, type Surface, type ContrastClass, type BaseTincture } from './surface';
export {
  FAILURE_TEXT, tinctureIssues, groupTinctureIssues, groundShares, groundContacts, shownSurfaces, counterchangeUnavailable, describeSlots, type ShownSurfaces,
} from './tincture-rule';
export { validate, normalise, type NormaliseResult } from './validate';
export { blazon, FACING_WORD, MODIFIER_WORDS, MODS_BEFORE_LINE, MODS_AFTER_LINE, ORIENTATION_WORDS, orientationWords, type BlazonOptions } from './blazon';
export { gloss } from './gloss';
export {
  DIVISION_LABEL, FUR_FAMILY_LABEL, FUR_LAYOUT_PLAIN, TREATMENT_LABEL, VARIATION_LABEL, ORDINARY_LABEL, LINE_LABEL, SHAPE_TOGGLE_LABEL, FACING_LABEL, GAZE_LABEL, ORIENTATION_LABEL, PAIR_LABEL, ordinaryCountLabel, ordinaryCountLegend, OUTLINE_LABEL, BAND_POSITION_LABEL, PLACE_LABEL, TINCTURE_LABEL, plainFirst, layoutLabel, chargeLabel, chargeWords, ordinaryWords, postureLabel, groupLabel,
  type PlainTerm,
} from './plain-words';
export { readability, BAND_LABEL, BAND_RANGE, isReadabilityBand, type Readability, type ReadabilityBand } from './readability';
export { deriveTags, filtersToTags, matchesTags, NO_FILTERS, type SearchFilters } from './tags';
export { searchCharges } from './charge-search';
export { buildSearchText, normaliseWords, matchesWords, queryWords, type SearchWord } from './search-terms';
export { signature } from './signature';
export {
  SHIELD_VIEWBOX, SHIELD_PATH, fieldRegions, fieldSurfaceAt, inFirstPart, divisionRegions, partitionContours, partIndexAt,
  drawnBox, slotTransform, chargeTransform, UPRIGHT, MIRRORED, probePoints, groundPoints, slotRow, slotColumn, shapeFrame, pathPolygon, pathRings, pointInPolygon,
  counterchangedSlotParts, type ArtPose, type Slot, type DividedField, type VariedField, type CounterchangePart,
} from './geometry';
export {
  specOf, plainSpec, isPlainSpec, defaultOrdinaryFrame, frameBeside, ordinaryFrameOf, bandPlace, ordinaryGeometry, liesAstride, fieldOrdinaryGeometry, counterchangedOrdinaryParts, counterchangedTrimParts, divisionCutsOrdinary,
  type OrdinarySpec, type OrdinaryFrame, type OrdinaryTrim,
} from './ordinary-geometry';
export { variationRegions, inFirstRegion, type Box } from './variation-geometry';
export { MIN_SLOT_SIZE, minSlotSize, groupSlotCount, hasRoom, contextSlots, groupSlots, canonicalSlots, capacityIssue, crampedInShape } from './layout';
export {
  PLACE_KINDS, placesOf, placesIn, pathOfPlace, placeOfPath, peripheralPlacesOf, isPeripheralPlace, placeKind, type PlaceKind, type PlaceKey, type PeripheralPlace, type Placed,
} from './places';
export {
  LAYER_KEYS, layersIn, addedLayerStep, layerChoices, addLayer, removeLayer, setLayerCharge, setOverallItem, overallItemChoices, setLayerTincture, refitLayers, ordinaryGroup, chargeItem, newCharge,
  setPeripheralItem, peripheralItemChoices,
  type LayerItem, type LayerKey, type LayerPlace, type PeripheralKey, type PicturesKey,
} from './layers';
export {
  COUNTS, isBlocked, firstAllowed, isAllowed, simpleParts, partsOf, assembleParts, withTincture, fieldTinctureChoices, groupTinctureChoices, countChoices, placementChoices, layoutChoices,
  layoutReason, withLayout, postureChoices, modifierChoices, facingChoices, gazeChoices, pairChoices, shownLayoutKey, fitGroup, suggestTinctureFix,
  partyDivisionChoices, partyTinctureChoices, groupVariationChoices, setGroupVariation, setGroupVariationPieces, groupVariationTinctureChoices, setGroupVariationTincture, setPartyDivision, setPartyTincture, splitGroup,
  type Choice, type AllowedChoice, type BlockedChoice, type LayoutChoice, type LayoutChoices, type PairChoice, type Placement, type Companion, type SimpleParts, type PartsInput, type TinctureFix,
} from './options';
export { FUR_KINDS, familyOfKind, furColours, furKindOf, furOfKind, furName, furGloss, takesColours, type FurFamily, type FurKind, type FurPaint } from './fur';
export { furChoices, furColourChoices, furAt, setFur, setFurColour } from './fur-options';
export { paintAt, type FieldPart, type PaintTarget } from './paint-target';
export { clearTreatment, treatmentAt, treatmentChoices, setTreatment, treatmentColourChoices, setTreatmentColour } from './treatment-options';
export { canStrew, semyAt, semyChoices, setSemy, clearSemy, semyColourChoices, setSemyColour } from './semy-options';
export { treatedName, treatedGloss } from './treatment';
export { hasNaturalColours, properChoice, setProper } from './proper-options';
export { furPattern, treatmentPattern, colourHex, ERMINE_SPOT } from './patterns';
export { renderLayers, badgeView, designTinctures, type Layer, type OrdinaryPart } from './render';
export { ORIENTATION_ANGLE, artPose, chargePoses, orientationTurns } from './pose';
export { fillCode, fillHatchTinctures, hatchTincture, solidFill, type Fill, type LeafFill, type SlotFill } from './paint-render';
export type { PatternSpec, SolidColour } from './patterns';
export { MODIFIER_ART, artKeyOf, chargePath, chargeOnBox } from './charge-art';
export { CHARGE_ART, CORE_ART_IDS } from './art/paths/index';
export { bboxOf, ringDepths, ringProblems, turnFit } from './art/geometry';
export { crossPath } from './art/procedural/crosses';
export type { ArtBox, ArtKey, DrawingMeta } from './art/types';
export { FIELD_SHAPES, DEFAULT_FIELD_SHAPE, FIELD_SHAPE_NAME, isFieldShape, type FieldShape, type ShapedDesign } from './shape';
export * from './tinctures';
export {
  SENA_RULES, isDiffAttr, isChangeKind, isSenaRule, isClear, differences, liftCotises, checkUnique, candidateKey, keysMayConflict, MIXED_PRIMARY, ANY_PRIMARY, explainDifferences, changeLabel, tallyText,
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
