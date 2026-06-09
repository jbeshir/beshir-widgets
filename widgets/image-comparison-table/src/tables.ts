// Table registry. Add a new comparison table by appending an entry here and
// dropping the matching images into `public/img/{full,thumb}/` (a sub-path in
// the image base, e.g. `imitation/family-gpt`, maps to a sub-folder).
//
// Image paths are relative — the widget uses `base: './'` so they resolve both
// over `http(s)://` and over `file://` (the offline render check).

export type Cell = {
  thumb: string;
  full: string;
  alt: string;
};

export type Column = {
  id: string;
  label: string;
  /** When true, this column's images are pre-existing reference art, not generated from the row prompt. */
  reference?: boolean;
};

export type Row = {
  id: string;
  label: string;
  /** Verbatim generation prompt used for the row's *generated* (non-reference) columns. */
  prompt: string | null;
  cells: Record<string, Cell>;
};

export type Table = {
  id: string;
  title: string;
  subtitle?: string;
  /** Optional note shown next to the prompt in the info popover. */
  promptNote?: string;
  columns: Column[];
  rows: Row[];
};

// `base` is the image file basename without extension, optionally including a
// sub-folder (e.g. `family-classic` or `imitation/family-gpt`).
function cell(base: string, rowLabel: string, colLabel: string): Cell {
  return {
    thumb: `img/thumb/${base}.jpg`,
    full: `img/full/${base}.jpg`,
    alt: `${rowLabel} — ${colLabel}`,
  };
}

const AI_CLASSIC_MOTIVATIONAL_PICTURES: Table = {
  id: 'ai-classic-motivational-pictures',
  title: 'Motivational Posters: Classic vs Modern AI',
  subtitle: "Early-era AI art compared with the same briefs given to today's best image models.",
  promptNote:
    "Prompt given verbatim to the modern image models. The 'Classic' column is pre-existing early-AI-era artwork, not generated from this prompt.",
  columns: [
    { id: 'classic', label: 'Classic', reference: true },
    { id: 'gpt', label: 'GPT-Image-2' },
    { id: 'gemini', label: 'Imagen-4-Ultra' },
  ],
  rows: [
    {
      id: 'family',
      label: 'Family',
      prompt:
        'In the style of early image models and imitating their weaknesses, create a family togetherness motivational picture featuring a family on a beach at sunset near a pier.',
      cells: {
        classic: cell('family-classic', 'Family', 'Classic'),
        gpt: cell('family-gpt', 'Family', 'GPT-Image-2'),
        gemini: cell('family-gemini', 'Family', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'perseverance',
      label: 'Perseverance',
      prompt:
        'In the style of early image models and imitating their weaknesses, create a perseverance motivational black and white picture featuring a hiker summitting a mountain with another peak in the background.',
      cells: {
        classic: cell('perseverance-classic', 'Perseverance', 'Classic'),
        gpt: cell('perseverance-gpt', 'Perseverance', 'GPT-Image-2'),
        gemini: cell('perseverance-gemini', 'Perseverance', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'love',
      label: 'Love',
      prompt:
        'In the style of early image models and imitating their weaknesses, create a love motivational poster featuring a red background of hearts and clouds.',
      cells: {
        classic: cell('love-classic', 'Love', 'Classic'),
        gpt: cell('love-gpt', 'Love', 'GPT-Image-2'),
        gemini: cell('love-gemini', 'Love', 'Imagen-4-Ultra'),
      },
    },
  ],
};

// Reusable "deliberately bad" style preamble that makes modern models reproduce
// the early-AI-era flaws (garbled text, flat silhouettes, oversaturated
// gradients, wonky proportions) as a chosen art style. The per-row concept is
// appended verbatim.
const BAD_STYLE_PREAMBLE = `A cheesy, over-rendered AI-generated motivational poster that deliberately imitates the look and the flaws of an early 2022-era text-to-image model — reproduce those flaws as the art style:
- TEXT: a huge ornate glowing serif-and-script title in glossy, slightly 3D beveled lettering, with several smaller lines of an inspirational quote beneath it, but ALL of the text is GARBLED, misspelled and nonsensical — melted, malformed, hallucinated letters and fake words that almost look like English but are not.
- SUBJECTS: rendered as flat, dark, featureless silhouettes or simplified shapes with slightly wonky, off proportions and no fine detail.
- COLOR & RENDERING: smooth airbrushed, oversaturated gradients with a warm glossy sheen, visible color banding, and a heavy dark vignette border.
- COMPOSITION: kitschy, symmetric, over-decorated, framed by swirly ornamental vector flourishes and decorative curls; clip-art inspirational-poster aesthetic.
Subject / concept: `;

const badPrompt = (concept: string): string => BAD_STYLE_PREAMBLE + concept;

const IMITATING_CLASSIC_AI_ART: Table = {
  id: 'imitating-classic-ai-art',
  title: 'Imitating the Classics: Modern AI Faking the Early-AI Look',
  subtitle:
    'The original early-AI posters beside today’s best models, prompted to deliberately reproduce their flaws — garbled text and all.',
  promptNote:
    "The full prompt used for the modern columns. The 'Classic' column is the original early-AI artwork these were asked to imitate.",
  columns: [
    { id: 'classic', label: 'Classic', reference: true },
    { id: 'gpt', label: 'GPT-Image-2' },
    { id: 'gemini', label: 'Imagen-4-Ultra' },
  ],
  rows: [
    {
      id: 'family',
      label: 'Family',
      prompt: badPrompt('a family on a beach at sunset near a pier'),
      cells: {
        classic: cell('family-classic', 'Family', 'Classic'),
        gpt: cell('imitation/family-gpt', 'Family', 'GPT-Image-2'),
        gemini: cell('imitation/family-gemini', 'Family', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'perseverance',
      label: 'Perseverance',
      prompt: badPrompt(
        'a hiker summiting a mountain with another peak in the background, in dramatic black and white',
      ),
      cells: {
        classic: cell('perseverance-classic', 'Perseverance', 'Classic'),
        gpt: cell('imitation/perseverance-gpt', 'Perseverance', 'GPT-Image-2'),
        gemini: cell('imitation/perseverance-gemini', 'Perseverance', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'love',
      label: 'Love',
      prompt: badPrompt('a giant glossy red love-heart among red clouds on a red background'),
      cells: {
        classic: cell('love-classic', 'Love', 'Classic'),
        gpt: cell('imitation/love-gpt', 'Love', 'GPT-Image-2'),
        gemini: cell('imitation/love-gemini', 'Love', 'Imagen-4-Ultra'),
      },
    },
  ],
};

// Expanded "deliberately bad" preamble: adds uncanny-valley figures (instead of
// only silhouettes), a misaligned decorative border that slices through the
// scene, and fried-HDR / banding / plastic-wrap rendering tells. The era is
// described without naming any model so the names don't leak into the garbled
// text the model renders.
const UNCANNY_STYLE_PREAMBLE = `A cheesy, over-rendered AI-generated motivational poster that deliberately imitates the look and the flaws of an early 2022-era text-to-image model — reproduce those flaws as the art style:
- TEXT: a huge ornate glowing serif-and-script title plus several smaller lines of an inspirational quote, but ALL the text is GARBLED — melted, misspelled, hallucinated letters and plausible-looking calligraphy that spells only invented nonsense (never real words, brand names, or any words from this description).
- FIGURES: any people are eerie and ALMOST-human but subtly wrong (uncanny valley), NOT clean silhouettes — waxy over-smooth plastic skin with no pores, asymmetric mismatched glassy eyes pointing in slightly different directions with a dead unfocused stare, a fused glowing white tooth-slab instead of separate teeth, melted/half-formed expressions, slightly-off skull and body proportions, and malformed hands with extra or fused fingers. Small or backlit figures may collapse into flat dark silhouettes.
- FRAME & BORDER: the scene bleeds to the very edges, and a separate ornate gold/cream decorative border is overlaid ON TOP as a glitchy misalignment — its lines cross over and slice THROUGH buildings and a figure's head/shoulder as if the frame and the picture were generated on separate misaligned layers; the four corner ornaments are all different and don't match; the border is slightly off-register and breaks or changes thickness mid-edge; heavy, uneven dark vignette.
- COLOR & RENDERING: a "fried", oversaturated HDR palette with blown highlights, visible color banding in the gradients, a warm glossy sheen, and a uniform plastic-wrap texture over every surface.
- COMPOSITION: kitschy, forced symmetry, over-decorated, clip-art floral/laurel scrollwork crowding the corners; generic inspirational-poster layout with slightly wonky, off proportions.
Subject / concept: `;

const uncannyPrompt = (concept: string): string => UNCANNY_STYLE_PREAMBLE + concept;

const IMITATING_CLASSIC_AI_ART_2: Table = {
  id: 'imitating-classic-ai-art-2',
  title: 'Imitating the Classics II: Uncanny-Valley Edition',
  subtitle:
    'A richer "deliberately bad" prompt — expanded with uncanny-valley figures and a misaligned border that slices through the scene.',
  promptNote:
    "The full prompt used for the modern columns. The 'Classic' column is the original early-AI artwork these were asked to imitate.",
  columns: [
    { id: 'classic', label: 'Classic', reference: true },
    { id: 'gpt', label: 'GPT-Image-2' },
    { id: 'gemini', label: 'Imagen-4-Ultra' },
  ],
  rows: [
    {
      id: 'family',
      label: 'Family',
      prompt: uncannyPrompt('a family on a beach at sunset near a pier'),
      cells: {
        classic: cell('family-classic', 'Family', 'Classic'),
        gpt: cell('imitation2/family-gpt', 'Family', 'GPT-Image-2'),
        gemini: cell('imitation2/family-gemini', 'Family', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'perseverance',
      label: 'Perseverance',
      prompt: uncannyPrompt(
        'a hiker summiting a mountain with another peak in the background, in dramatic black and white',
      ),
      cells: {
        classic: cell('perseverance-classic', 'Perseverance', 'Classic'),
        gpt: cell('imitation2/perseverance-gpt', 'Perseverance', 'GPT-Image-2'),
        gemini: cell('imitation2/perseverance-gemini', 'Perseverance', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'love',
      label: 'Love',
      prompt: uncannyPrompt('a giant glossy red love-heart among red clouds on a red background'),
      cells: {
        classic: cell('love-classic', 'Love', 'Classic'),
        gpt: cell('imitation2/love-gpt', 'Love', 'GPT-Image-2'),
        gemini: cell('imitation2/love-gemini', 'Love', 'Imagen-4-Ultra'),
      },
    },
  ],
};

export const TABLES: Record<string, Table> = {
  [AI_CLASSIC_MOTIVATIONAL_PICTURES.id]: AI_CLASSIC_MOTIVATIONAL_PICTURES,
  [IMITATING_CLASSIC_AI_ART.id]: IMITATING_CLASSIC_AI_ART,
  [IMITATING_CLASSIC_AI_ART_2.id]: IMITATING_CLASSIC_AI_ART_2,
};

export const DEFAULT_TABLE_ID = 'ai-classic-motivational-pictures';

export function resolveTable(id: string | null | undefined): Table {
  if (id && Object.prototype.hasOwnProperty.call(TABLES, id)) return TABLES[id];
  return TABLES[DEFAULT_TABLE_ID];
}
