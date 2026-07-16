/**
 * Renderer test for the pure-render Valider success panel. Covers the French
 * heading/copy, conditional PDF/HTML path lines, the conditional amber
 * warning line, and the "Afficher dans le dossier" button click wiring.
 * Mirrors the `RoundDiffPanel`/`RegenControls` component-test style.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValidationSuccessPanel } from "./ValidationSuccessPanel";

describe("ValidationSuccessPanel", () => {
  it("renders the French success heading and testid", () => {
    render(
      <ValidationSuccessPanel
        validationResult={{ htmlPath: "/tmp/resume.html" }}
        onRevealInFolder={vi.fn()}
      />,
    );

    expect(screen.getByTestId("validation-success-panel")).not.toBeNull();
    expect(screen.getByText("CV généré avec succès")).not.toBeNull();
  });

  it("shows both PDF and HTML path lines when both are present", () => {
    render(
      <ValidationSuccessPanel
        validationResult={{
          htmlPath: "/tmp/candidatures/doctolib_dev/resume.html",
          pdfPath: "/tmp/candidatures/doctolib_dev/resume.pdf",
        }}
        onRevealInFolder={vi.fn()}
      />,
    );

    expect(screen.getByText("PDF :")).not.toBeNull();
    // The path renders as a bare text node alongside the "PDF :"/"HTML :"
    // label <span> within the same <p>, so no single node's EXACT text
    // equals just the path — use a substring match against the <p>.
    expect(
      screen.getByText("/tmp/candidatures/doctolib_dev/resume.pdf", {
        exact: false,
      }),
    ).not.toBeNull();
    expect(screen.getByText("HTML :")).not.toBeNull();
    expect(
      screen.getByText("/tmp/candidatures/doctolib_dev/resume.html", {
        exact: false,
      }),
    ).not.toBeNull();
  });

  it("shows only the HTML line when pdfPath is absent (partial-success case)", () => {
    render(
      <ValidationSuccessPanel
        validationResult={{ htmlPath: "/tmp/resume.html" }}
        onRevealInFolder={vi.fn()}
      />,
    );

    expect(screen.queryByText("PDF :")).toBeNull();
    expect(screen.getByText("HTML :")).not.toBeNull();
  });

  it("shows the amber warning line only when warning is set", () => {
    const { rerender } = render(
      <ValidationSuccessPanel
        validationResult={{ htmlPath: "/tmp/resume.html" }}
        onRevealInFolder={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/génération du PDF a échoué/),
    ).toBeNull();

    rerender(
      <ValidationSuccessPanel
        validationResult={{
          htmlPath: "/tmp/resume.html",
          warning: "La génération du PDF a échoué.",
        }}
        onRevealInFolder={vi.fn()}
      />,
    );
    expect(
      screen.getByText("La génération du PDF a échoué."),
    ).not.toBeNull();
  });

  it("calls onRevealInFolder when the button is clicked", () => {
    const onRevealInFolder = vi.fn();
    render(
      <ValidationSuccessPanel
        validationResult={{ htmlPath: "/tmp/resume.html" }}
        onRevealInFolder={onRevealInFolder}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Afficher dans le dossier/ }),
    );
    expect(onRevealInFolder).toHaveBeenCalledTimes(1);
  });
});
