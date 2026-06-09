// Table registry. Add a new comparison table by appending an entry here and
// dropping the matching images into `public/img/{full,thumb}/`.
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

function imgs(row: string, col: string, rowLabel: string, colLabel: string): Cell {
  return {
    thumb: `img/thumb/${row}-${col}.jpg`,
    full: `img/full/${row}-${col}.jpg`,
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
        classic: imgs('family', 'classic', 'Family', 'Classic'),
        gpt: imgs('family', 'gpt', 'Family', 'GPT-Image-2'),
        gemini: imgs('family', 'gemini', 'Family', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'perseverance',
      label: 'Perseverance',
      prompt:
        'In the style of early image models and imitating their weaknesses, create a perseverance motivational black and white picture featuring a hiker summitting a mountain with another peak in the background.',
      cells: {
        classic: imgs('perseverance', 'classic', 'Perseverance', 'Classic'),
        gpt: imgs('perseverance', 'gpt', 'Perseverance', 'GPT-Image-2'),
        gemini: imgs('perseverance', 'gemini', 'Perseverance', 'Imagen-4-Ultra'),
      },
    },
    {
      id: 'love',
      label: 'Love',
      prompt:
        'In the style of early image models and imitating their weaknesses, create a love motivational poster featuring a red background of hearts and clouds.',
      cells: {
        classic: imgs('love', 'classic', 'Love', 'Classic'),
        gpt: imgs('love', 'gpt', 'Love', 'GPT-Image-2'),
        gemini: imgs('love', 'gemini', 'Love', 'Imagen-4-Ultra'),
      },
    },
  ],
};

export const TABLES: Record<string, Table> = {
  [AI_CLASSIC_MOTIVATIONAL_PICTURES.id]: AI_CLASSIC_MOTIVATIONAL_PICTURES,
};

export const DEFAULT_TABLE_ID = 'ai-classic-motivational-pictures';

export function resolveTable(id: string | null | undefined): Table {
  if (id && Object.prototype.hasOwnProperty.call(TABLES, id)) return TABLES[id];
  return TABLES[DEFAULT_TABLE_ID];
}
