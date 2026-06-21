// Unit tests for the pure translation helpers — exits non-zero on any failure.

import { buildTranslateMessages, cleanTranslation } from '../src/translate-shared';

const fails: string[] = [];
let pass = 0;

function assert(cond: boolean, msg: string): void {
  if (!cond) fails.push(msg);
  else pass++;
}

// ── buildTranslateMessages ────────────────────────────────────────────────────

const msgs = buildTranslateMessages('drink', ['must', 'past'], 'のまなければならなかった');

assert(msgs.length === 2, 'returns exactly 2 messages');
assert(msgs[0].role === 'system', 'first message role is system');
assert(msgs[1].role === 'user', 'second message role is user');
assert(
  msgs[0].content.includes('Reply with only'),
  'system message includes "Reply with only"',
);
assert(msgs[0].content.includes('/no_think'), 'system message carries the /no_think switch');
assert(msgs[1].content.includes('drink'), 'user message includes base "drink"');
assert(msgs[1].content.includes('must · past'), 'user message includes joined features "must · past"');
assert(
  msgs[1].content.includes('のまなければならなかった'),
  'user message includes form "のまなければならなかった"',
);

// Empty features: joined string is '' — user message still contains base and form
const msgsEmpty = buildTranslateMessages('drink', [], 'のむ');
assert(msgsEmpty[1].content.includes('drink'), 'empty features: user message includes base');
assert(msgsEmpty[1].content.includes('のむ'), 'empty features: user message includes form');

// ── cleanTranslation ──────────────────────────────────────────────────────────

assert(cleanTranslation('  had to drink  ') === 'had to drink', 'trims surrounding whitespace');
assert(
  cleanTranslation('had to drink\nextra line') === 'had to drink',
  'first-line-only: drops lines after newline',
);

// Reasoning-tag stripping (Qwen3 <think> hedge)
assert(
  cleanTranslation('<think>let me reason</think>had to drink') === 'had to drink',
  'strips an inline <think> block',
);
assert(
  cleanTranslation('<think>\nstep one\nstep two\n</think>\nhad to drink') === 'had to drink',
  'strips a multiline <think> block and leading newlines',
);
assert(cleanTranslation('<think>only thinking</think>') === '', 'think-only output → empty');
assert(cleanTranslation('<think>truncated thinking, no close tag') === '', 'unclosed <think> → empty');

// Quote stripping
assert(cleanTranslation('"had to drink"') === 'had to drink', 'strips straight double quotes');
assert(cleanTranslation("'had to drink'") === 'had to drink', 'strips straight single quotes');
assert(cleanTranslation('“had to drink”') === 'had to drink', 'strips smart double quotes');
assert(cleanTranslation('‘had to drink’') === 'had to drink', 'strips smart single quotes');

// Trailing punctuation
assert(cleanTranslation('had to drink.') === 'had to drink', 'strips trailing period');
assert(cleanTranslation('had to drink。') === 'had to drink', 'strips trailing 。');

// Internal whitespace collapse
assert(
  cleanTranslation('had   to\tdrink') === 'had to drink',
  'collapses internal whitespace runs',
);

// Empty / garbage
assert(cleanTranslation('') === '', 'empty string returns empty string');
assert(cleanTranslation('   ') === '', 'whitespace-only returns empty string');
assert(cleanTranslation('\n') === '', 'newline-only returns empty string');

// Combined: quote strip + trailing period + trim, no lowercasing
assert(
  cleanTranslation('  "Had to drink."  ') === 'Had to drink',
  'combined: trim + quote strip + trailing period, preserves case',
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`translate helpers: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('FAIL: ' + f);
  process.exit(1);
}
