// The one place that decides <html data-widget-state> (PLAN §7), from the active tab and its
// status. Dialogs and sheets never change it: they keep the underlying tab's state.

import type { DesignStatus } from './builder';

export type WidgetState = 'loading' | 'ready' | 'populated' | 'empty' | 'error';
export type Tab = 'design' | 'registry' | 'yours';
export type ListStatus = 'loading' | 'populated' | 'empty' | 'error';

export interface StateInputs {
  tab: Tab;
  design: DesignStatus;
  /** A check-availability result is on screen (counts as populated). */
  checkShown: boolean;
  registry: ListStatus;
  yours: 'populated' | 'empty';
}

export function computeWidgetState(s: StateInputs): WidgetState {
  switch (s.tab) {
    case 'design':
      if (s.design === 'violation') return 'error';
      return s.design === 'valid' || s.checkShown ? 'populated' : 'ready';
    case 'registry':
      return s.registry;
    case 'yours':
      return s.yours;
  }
}
