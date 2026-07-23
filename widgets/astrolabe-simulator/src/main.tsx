import { render } from 'preact';
import { App } from './App';
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

const root = document.getElementById('root');
if (root) render(<App />, root);
