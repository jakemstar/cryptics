"use client";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
] as const;

type OnScreenKeyboardProps = {
  disabled: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
};

export function OnScreenKeyboard({
  disabled,
  onLetter,
  onBackspace,
}: OnScreenKeyboardProps) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-30 px-2 sm:px-4">
      <div className="mx-auto w-full max-w-[48rem]">
        <div className="flex flex-col gap-1 sm:gap-1.5">
          {KEYBOARD_ROWS.map((row, rowIndex) => {
            const rowColumns = rowIndex === 0 ? "grid-cols-10" : "grid-cols-9";

            return (
              <div className={`grid w-full ${rowColumns} gap-1 sm:gap-1.5`} key={`row-${rowIndex}`}>
                {row.map((keyValue) => {
                  const isBackspace = keyValue === "BACKSPACE";
                  const label = isBackspace ? "Delete" : keyValue;
                  const ariaLabel = isBackspace
                    ? "Backspace"
                    : `Letter ${keyValue}`;

                  return (
                    <button
                      aria-label={ariaLabel}
                      className={`h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-1.5 text-xs font-semibold text-(--color-text) transition-colors hover:bg-(--color-surface-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:px-2 sm:text-sm ${
                        isBackspace ? "col-span-2" : ""
                      }`}
                      disabled={disabled}
                      key={keyValue}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (isBackspace) {
                          onBackspace();
                          return;
                        }

                        onLetter(keyValue);
                      }}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
