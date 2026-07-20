import { render } from 'preact';
import './theme.css';
import './accessibility.css';
import { App } from './App';
render(<App/>, document.getElementById('app')!);
