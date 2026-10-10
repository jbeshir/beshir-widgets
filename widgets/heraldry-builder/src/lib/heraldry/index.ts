// Public API of the DOM-free heraldry library, shared by the SPA and the Worker. Only what they use is
// re-exported; modules import each other directly.

export { API_ERROR, isApiErrorCode, type ApiErrorCode, type TokenProblem } from './api-errors';
export { blazon } from './blazon';
export { CHARGE_ART, chargePath } from './charge-art';
export { POSTURES, POSTURE_GLOSS, CHARGE_CATEGORIES, CATEGORY_LABEL, CHARGE_IDS, CHARGES, isChargeId, postureTerm, postureGloss, chargesInCategory, chargeGroup, chargesInGroup, type Posture, type ChargeCategory, type ChargeId } from './charges';
export { registrationOrder, reportUniqueness, checkResponse, type RegistryRef, type CheckableEntry, type ConflictSummary, type ComparedEntry, type UniquenessReport, type TakenReport, type CheckResponse } from './check';
export { NO_CONTACT, DISCORD_MAX, cleanDiscord, cleanContact, type Contact } from './contact';
export { DIVISIONS, ORDINARY_TYPES, ARRANGEMENTS, COUNTS, BETWEEN_COUNTS, NUMBER_WORD, DIVISION_PART_LABEL, fieldTinctures, fieldDivision, chargeContext, legalArrangements, defaultArrangement, chargeNoun, resolve, structuralIssues, chargeStructureIssue, type Division, type OrdinaryType, type Ordinary, type Arrangement, type Count, type Placement, type Design, type NormDesign, type Issue } from './design';
export { isDiffAttr, POINTS, divisionGroup, ordinaryGroup, differences, score, areDistinct, checkUnique, candidateKey, CLEAR_CHANGE_HINT, HALF_DIFFERENCE_HINT, explainDifferences, pointsText, pointsLabel, tallyText, type DiffAttr, type MinorReason, type RegistryEntryLike, type Verdict, type DifferenceNote } from './difference';
export { EMAIL_MAX, cleanEmail, isMailOutcome, type MailOutcome } from './email';
export { SHIELD_VIEWBOX, SHIELD_PATH, inFirstPart, ORDINARY_FILL_RULE, drawnBox, BETWEEN_SLOTS, SHAPE_LAYOUT, fieldRegions, slotsFor, chargeSlots, shapedChargeSlots, probePoints, counterchangedParts, type Slot } from './geometry';
export { BETWEEN_GLOSS, gloss } from './gloss';
export { asObject } from './json';
export { fieldTinctureChoices, ordinaryTinctureChoices, chargeTinctureChoices, countChoices, placementChoices, arrangementChoices, postureChoices, fitCharges, suggestTinctureFix, isBlocked, blockReason, type Choice, type ChargedDesign, type Companion, type LayoutChoice } from './options';
export { plainFirst, chargeLabel, chargeWords, ordinaryWords, DIVISION_LABEL, ORDINARY_LABEL, ARRANGEMENT_LABEL, TINCTURE_LABEL, postureLabel, type PlainTerm } from './plain-words';
export { BAND_LABEL, isReadabilityBand, BAND_RANGE, designTinctures, readability, type Readability, type ReadabilityBand } from './readability';
export { FILTER_PARAMS, NO_SEARCH_PARAMS, parseSearchParams, searchParamsFromUrl, searchParamsToUrl, searchEntries, type SearchParams, type SearchableEntry } from './search';
export { normaliseWords, buildSearchText, matchesWords, queryWords } from './search-terms';
export { FIELD_SHAPES, DEFAULT_FIELD_SHAPE, FIELD_SHAPE_NAME, isFieldShape, type FieldShape, type ShapedDesign } from './shape';
export { signature } from './signature';
export { deriveTags, NO_FILTERS, filtersToTags, matchesTags, type SearchFilters } from './tags';
export { DISPLAY_NAME_MAX, cleanDisplayName } from './text';
export { contrastFailure, chargeContrastFailure, chargeSlotContacts, tinctureIssues } from './tincture-rule';
export { METALS, COLOURS, TINCTURES, TINCTURE_CLASS, NON_STANDARD_NOTE, TINCTURE_CODE, TINCTURE_FILL, OUTLINE_COLOUR, TINCTURE_HATCHING, isMetal, CHARGE_TINCTURES, type Tincture, type Hatching, type ChargeTincture } from './tinctures';
export { validate, normalise } from './validate';
