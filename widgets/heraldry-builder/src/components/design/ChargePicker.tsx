// The picture list: a search box, the tabs (Popular first, then one per kind of picture) and the tiles of the tab
// chosen, or of the pictures a typed query finds. Shared by the Picture step and the Scatter picker, which differ in
// the test ids (`base`) and in which pictures are blocked.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  CATEGORY_LABEL, CHARGE_CATEGORIES, CHARGES, POPULAR_CHARGE_IDS, chargeLabel, chargePath, chargesInCategory, searchCharges,
  type ChargeCategory, type ChargeId,
} from '../../lib/heraldry';
import { ChargeIcon } from '../Shield';
import { ChoiceButton, RadioGroup, type OptionStatus } from './Choices';
import { useExplainer } from './Explainer';

type ChargeTab = 'popular' | ChargeCategory;

const TABS: readonly ChargeTab[] = ['popular', ...CHARGE_CATEGORIES];

const TAB_LABEL: Record<ChargeTab, string> = { popular: 'Popular', ...CATEGORY_LABEL };

/** The most pictures a search shows. */
const MAX_RESULTS = 40;

const OPEN = (): OptionStatus => ({ kind: 'open' });

const idsOf = (tab: ChargeTab): readonly ChargeId[] => (tab === 'popular' ? POPULAR_CHARGE_IDS : chargesInCategory(tab).map((m) => m.id));

/** The tab a picture is found on: Popular when it is there (or nothing is chosen), else its kind. */
function tabOf(charge: ChargeId | null): ChargeTab {
  return charge === null || POPULAR_CHARGE_IDS.includes(charge) ? 'popular' : CHARGES[charge].category;
}

interface Props {
  /** Test ids: `<base>-search`, `<base>-tab-<tab>`, `<base>-<id>` for a tile, `<base>-select` for the list. */
  base: string;
  selected: ChargeId | null;
  /** The tile for choosing no picture, shown above the tiles. */
  none: ComponentChildren;
  /** Whether a picture can be chosen here; a blocked tile says why when pressed. Every picture is open when omitted. */
  status?: (id: ChargeId) => OptionStatus;
  onSelect: (id: ChargeId) => void;
}

export function ChargePicker({ base, selected, none, status = OPEN, onSelect }: Props) {
  const [tab, setTab] = useState<ChargeTab>(() => tabOf(selected));
  const [query, setQuery] = useState('');
  const why = useExplainer();
  // A design loaded from outside (an example, a registry entry) brings its own picture along: show the tab it is on.
  useEffect(() => {
    if (selected && !idsOf(tab).includes(selected)) setTab(tabOf(selected));
  }, [selected]);

  const searching = query.trim() !== '';
  const found = searching ? searchCharges(query).slice(0, MAX_RESULTS) : [];
  const tile = (id: ChargeId) => (
    <ChoiceButton key={id} testid={`${base}-${id}`} checked={selected === id} status={status(id)} label={chargeLabel(id)} onSelect={() => onSelect(id)} onBlocked={why.explain} class="icon-choice charge-choice">
      <ChargeIcon path={chargePath({ charge: id, form: null, posture: CHARGES[id].defaultPosture, mods: [] })} size={30} />
      <span class="choice-label">{chargeLabel(id)}</span>
    </ChoiceButton>
  );

  return (
    <>
      <input
        class="text-input"
        type="search"
        data-testid={`${base}-search`}
        aria-label="Find a picture"
        placeholder="Find a picture, e.g. star"
        value={query}
        maxLength={40}
        autoComplete="off"
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      <RadioGroup label="Kind of picture" class="charge-tabs" testid={`${base}-tabs`}>
        {TABS.map((t) => (
          <ChoiceButton key={t} testid={`${base}-tab-${t}`} checked={!searching && tab === t} label={TAB_LABEL[t]} onSelect={() => { setQuery(''); setTab(t); }} onBlocked={() => {}} class="chip-choice">
            <span>{TAB_LABEL[t]}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      <RadioGroup label="Picture" class="charge-picker" testid={`${base}-select`}>
        <div class="charge-category">{none}</div>
        {searching ? (
          <div class="charge-category" data-testid={`${base}-search-results`} role="group" aria-label="Search results">
            {found.length ? <div class="icon-grid icon-grid-charges">{found.map(tile)}</div> : <p class="field-hint">No pictures match</p>}
          </div>
        ) : (
          <div class="charge-category" role="group" aria-label={TAB_LABEL[tab]}>
            <p class="charge-category-label" aria-hidden="true">{TAB_LABEL[tab]}</p>
            <div class="icon-grid icon-grid-charges">{idsOf(tab).map(tile)}</div>
          </div>
        )}
      </RadioGroup>
      {why.node}
    </>
  );
}

export function NoneIcon() {
  return (
    <svg class="none-icon" viewBox="0 0 30 36" width="30" height="36" aria-hidden="true" focusable="false">
      <path d="M1 1H29V18C29 27.6 22.8 33 15 36C7.2 33 1 27.6 1 18Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2.5" />
    </svg>
  );
}
