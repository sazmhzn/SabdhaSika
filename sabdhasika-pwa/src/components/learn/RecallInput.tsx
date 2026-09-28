"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Choice } from "@/lib/engine/quiz";

/* ------------------------------------------------------------------ *
 * Multiple choice
 * ------------------------------------------------------------------ */

export interface ChoiceOptionsProps {
  choices: Choice[];
  /** Revealed only after the learner commits. */
  correctId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function ChoiceOptions({
  choices,
  correctId,
  selectedId,
  onSelect,
  disabled,
}: ChoiceOptionsProps) {
  const answered = selectedId !== null;

  return (
    <div className="grid gap-2" role="group" aria-label="Choose the meaning">
      {choices.map((choice, i) => {
        const isCorrect = choice.id === correctId;
        const isSelected = choice.id === selectedId;
        const revealCorrect = answered && isCorrect;
        const revealWrong = answered && isSelected && !isCorrect;

        return (
          <motion.button
            key={choice.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.035, duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            disabled={disabled || answered}
            onClick={() => onSelect(choice.id)}
            aria-pressed={isSelected}
            className={cn(
              "press chrome-noselect flex min-h-12 items-center justify-between gap-3 rounded-row border px-4 py-3 text-left",
              "text-[14px] font-medium",
              !answered && "border-line bg-paper text-ink hover:border-line-strong",
              revealCorrect && "border-good bg-good-soft text-ink",
              revealWrong && "border-bad bg-bad-soft text-ink",
              answered && !isCorrect && !isSelected && "border-line bg-paper text-faint",
            )}
          >
            <span className="min-w-0">{choice.label}</span>
            {/* Icon AND colour: never colour alone. */}
            {revealCorrect && (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-good text-paper">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            )}
            {revealWrong && (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-bad text-paper">
                <X className="size-3.5" strokeWidth={3} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Typed answer
 * ------------------------------------------------------------------ */

export interface TypeAnswerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  answered: boolean;
  correct: boolean;
  prompt: string;
  placeholder: string;
  /** e.g. "食べる · taberu" shown after a wrong answer. */
  reveal?: string;
  disabled?: boolean;
}

export function TypeAnswer({
  value,
  onChange,
  onSubmit,
  answered,
  correct,
  prompt,
  placeholder,
  reveal,
  disabled,
}: TypeAnswerProps) {
  return (
    <div className="w-full">
      <label className="block text-[12px] font-medium text-muted" htmlFor="typed-answer">
        {prompt}
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-2"
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-row border bg-paper px-4 transition-colors",
            !answered && "border-line focus-within:border-line-strong",
            answered && correct && "border-good bg-good-soft",
            answered && !correct && "border-bad bg-bad-soft",
          )}
        >
          <input
            id="typed-answer"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            dir="auto"
            disabled={disabled || answered}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={answered && !correct}
            aria-describedby={answered ? "typed-answer-feedback" : undefined}
            className={cn(
              "h-12 w-full bg-transparent text-[16px] font-medium text-ink outline-none",
              "placeholder:font-normal placeholder:text-faint",
            )}
          />
          {answered && (
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-paper",
                correct ? "bg-good" : "bg-bad",
              )}
              aria-hidden="true"
            >
              {correct ? (
                <Check className="size-4" strokeWidth={3} />
              ) : (
                <X className="size-4" strokeWidth={3} />
              )}
            </span>
          )}
        </div>

        {answered ? (
          <p
            id="typed-answer-feedback"
            role="status"
            className="mt-3 text-[13px] font-medium text-ink-soft"
          >
            {correct ? "That's it." : <>It&rsquo;s <span className="text-ink">{reveal}</span></>}
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-faint">
            Any form counts — script, reading or romanization.
          </p>
        )}
      </form>
    </div>
  );
}
