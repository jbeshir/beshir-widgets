import { render } from 'preact';
import { App } from './App';
import { chargeIdsOf, loadArtFor } from './lib/heraldry';
import { loadDraft } from './store';
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/700.css';
import './theme.css';
import './styles.css';

// Embedded in an iframe the frame is already the container, so shed the
// standalone page chrome (outer background, centering, card shadow/border)
// and let the card fill the frame. Append ?embed=0 to force the framed look.
if (window.self !== window.top && new URLSearchParams(location.search).get('embed') !== '0') {
  document.documentElement.classList.add('embedded');
}

// The draft's art is loaded before the first paint (art outside the main chunk comes in a chunk of its own), so it is never drawn
// without it.
const root = document.getElementById('app');
const draft = loadDraft();
if (root) void loadArtFor(draft ? chargeIdsOf(draft.design) : []).then(() => render(<App draft={draft} />, root));
