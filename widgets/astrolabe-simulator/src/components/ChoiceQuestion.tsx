import type { JSX } from 'preact';
import type { ChoiceCheck } from '../tutorial/types';

export interface ChoiceFeedback { correct: boolean; note: string }

interface ChoiceQuestionProps {
  check: ChoiceCheck;
  selected: number | null;
  feedback: ChoiceFeedback | null;
  onSelect(index: number): void;
}

/** A reading or prediction question: a labelled radio group. The guide's Check button grades the pick. */
export function ChoiceQuestion({ check, selected, feedback, onSelect }: ChoiceQuestionProps): JSX.Element {
  return <fieldset className="choice" data-testid="choice">
    <legend>{check.prompt}</legend>
    {check.options.map((option, index) => {
      const id = `choice-option-${index}`;
      return <div className="choice-option" key={option.label}>
        <input type="radio" id={id} name="lesson-choice" checked={selected === index}
          aria-describedby={selected === index && feedback ? 'choice-feedback' : undefined}
          onChange={() => onSelect(index)} />
        <label htmlFor={id}>{option.label}</label>
      </div>;
    })}
    {feedback && <p id="choice-feedback" className={`choice-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
      <strong>{feedback.correct ? 'Correct.' : 'Not quite.'}</strong> {feedback.note}
    </p>}
  </fieldset>;
}
