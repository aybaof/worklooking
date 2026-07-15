/**
 * Tier 3 — renderer component. Pure-presentation sandboxed preview surface for
 * the CV feedback loop. Asserts the preview renders the themed HTML at its TRUE
 * CSS size (A4 `210mm` page width, natural height) and scrolls to fit rather
 * than being scaled/squished — so a multi-page CV scrolls like the real PDF.
 * (jsdom has no layout engine, so this asserts the structural/style intent, not
 * computed pixel sizes.)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewFrame } from "./PreviewFrame";

describe("PreviewFrame (true-scale + scroll)", () => {
  it("renders the iframe at its natural A4 page width (no fit-scaling)", () => {
    render(<PreviewFrame html="<div>aperçu</div>" isLoading={false} />);

    const iframe = screen.getByTitle("Aperçu du CV") as HTMLIFrameElement;
    // True 100% scale: the page is a fixed 210mm-wide A4 page, NOT aspect-locked
    // to a fit box. Width is the real mm page size.
    expect(iframe.style.width).toBe("210mm");
    // A height is set (measured content height, or the A4 fallback until load).
    expect(iframe.style.height.length).toBeGreaterThan(0);
    // The iframe manages its own scroll off (outer container scrolls instead).
    expect(iframe.getAttribute("scrolling")).toBe("no");
  });

  it("scrolls to fit via an overflow-auto container and does NOT aspect-lock", () => {
    const { container } = render(
      <PreviewFrame html="<div>aperçu</div>" isLoading={false} />,
    );

    // Outer container scrolls (multi-page CV scrolls like the real PDF).
    const wrapper = container.firstChild as HTMLElement;
    const wrapperClasses = wrapper.className.split(/\s+/);
    expect(wrapperClasses).toContain("overflow-auto");

    // The page is NOT locked to the old A4 fit-box ratio and does NOT stretch
    // to fill: no aspect-lock, no fit-to-box width caps.
    const iframe = screen.getByTitle("Aperçu du CV");
    const pageBox = iframe.parentElement as HTMLElement;
    const pageClasses = pageBox.className.split(/\s+/);
    expect(pageClasses).not.toContain("aspect-[210/297]");
    expect(pageClasses).not.toContain("w-auto");
    expect(pageClasses).not.toContain("max-w-full");
    expect(pageClasses).not.toContain("max-h-full");
    // The inner box centers the fixed-width page horizontally when there is
    // spare width, but lets it overflow/scroll otherwise.
    expect(pageClasses).toContain("justify-center");
  });

  it("keeps the sandboxed iframe when html is present", () => {
    render(<PreviewFrame html="<div>aperçu</div>" isLoading={false} />);

    const iframe = screen.getByTitle("Aperçu du CV") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin");
  });

  it("shows the spinner while loading and renders no page when html is empty", () => {
    const { container } = render(<PreviewFrame html="" isLoading={true} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    // No iframe/page box without html.
    expect(screen.queryByTitle("Aperçu du CV")).toBeNull();
  });
});
