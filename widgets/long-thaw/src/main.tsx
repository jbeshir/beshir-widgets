import { render } from 'preact';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/700.css';
import './theme.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);
