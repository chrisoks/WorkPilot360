"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ISOLATED_FORM_TEXT_COMMIT_DELAY_MS = 250;

export function IsolatedFormTextControl({
  value,
  onChange,
  as = "input",
  type = "text",
  rows,
  maxLength,
  placeholder,
  className,
  disabled,
  readOnly,
  title,
  autoComplete,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  as?: "input" | "textarea";
  type?: "text" | "search" | "email" | "tel";
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
  autoComplete?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const lastEmittedValueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (value !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = value;
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  const emitValue = useCallback((nextValue: string) => {
    if (nextValue === lastEmittedValueRef.current) return;
    lastEmittedValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  }, []);

  useEffect(() => {
    if (draft === lastEmittedValueRef.current) return;
    const timeoutId = window.setTimeout(
      () => emitValue(draft),
      ISOLATED_FORM_TEXT_COMMIT_DELAY_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [draft, emitValue]);

  const handleChange = (nextValue: string) => {
    draftRef.current = nextValue;
    setDraft(nextValue);
  };
  const handleBlur = () => {
    emitValue(draftRef.current);
    onBlur?.();
  };

  if (as === "textarea") {
    return (
      <textarea
        value={draft}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        title={title}
        autoComplete={autoComplete}
        onFocus={onFocus}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.target.value)}
      />
    );
  }

  return (
    <input
      type={type}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      title={title}
      autoComplete={autoComplete}
      onFocus={onFocus}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "Enter") emitValue(draftRef.current);
      }}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}
