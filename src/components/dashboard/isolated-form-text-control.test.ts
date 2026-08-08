import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ISOLATED_FORM_TEXT_COMMIT_DELAY_MS,
  IsolatedFormTextControl,
} from "./isolated-form-text-control";

describe("IsolatedFormTextControl", () => {
  it("renders the complete input value without trimming whitespace", () => {
    const markup = renderToStaticMarkup(createElement(IsolatedFormTextControl, {
      type: "email",
      value: "rechnung test@example.de ",
      maxLength: 200,
      onChange: vi.fn(),
    }));

    expect(markup).toContain('type="email"');
    expect(markup).toContain('maxLength="200"');
    expect(markup).toContain('value="rechnung test@example.de "');
  });

  it("renders multiline customer text and keeps its field contract", () => {
    const markup = renderToStaticMarkup(createElement(IsolatedFormTextControl, {
      as: "textarea",
      rows: 4,
      maxLength: 4_000,
      value: "Erste Zeile\nZweite Zeile ",
      placeholder: "Kundentext",
      onChange: vi.fn(),
    }));

    expect(markup).toContain('rows="4"');
    expect(markup).toContain('maxLength="4000"');
    expect(markup).toContain("Erste Zeile\nZweite Zeile ");
    expect(ISOLATED_FORM_TEXT_COMMIT_DELAY_MS).toBe(250);
  });
});
