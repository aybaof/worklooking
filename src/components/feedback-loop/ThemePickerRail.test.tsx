/**
 * Tier 3 — renderer component. Collapsed-by-default theme picker for the
 * feedback modal's left rail: toggle labeled with the current theme's name,
 * expanding to a compact grid of per-theme live thumbnails (each owning its
 * own `renderPreview` call + loading/error state, modeled on
 * `TemplateSelector`'s `PreviewCard` but smaller/simpler). Covers AC-2, AC-3,
 * AC-4, AC-5, AC-12, AC-13.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import type { Resume } from "@/../shared/resume-types";
import type { ThemeInfo } from "@/hooks/useTemplateSelection";
import { ThemePickerRail } from "./ThemePickerRail";

const resume: Resume = {
  basics: { summary: "Profil" },
  work: [{ name: "ACME" }],
};

const themes: ThemeInfo[] = [
  { id: "modern-sidebar", label: "Modern Sidebar", description: "" },
  { id: "professional", label: "Professional", description: "" },
  { id: "simple", label: "Simple", description: "" },
];

function baseProps(
  overrides: Partial<Parameters<typeof ThemePickerRail>[0]> = {},
) {
  return {
    resume,
    selectedTheme: "modern-sidebar",
    availableThemes: themes,
    disabled: false,
    onSelectTheme: vi.fn(),
    renderPreview: vi.fn().mockResolvedValue("<div>aperçu</div>"),
    ...overrides,
  };
}

describe("ThemePickerRail", () => {
  it("is collapsed by default and shows a toggle labeled with the current theme's name (AC-2)", () => {
    render(<ThemePickerRail {...baseProps()} />);

    expect(screen.getByText("Thème : Modern Sidebar")).not.toBeNull();
    // No thumbnail grid mounted while collapsed.
    expect(screen.queryByText("Professional")).toBeNull();
    expect(screen.queryByText("Simple")).toBeNull();
  });

  it("clicking the toggle expands the grid with one thumbnail per theme, and no renderPreview call fires while collapsed (AC-3, AC-4)", async () => {
    const renderPreview = vi.fn().mockResolvedValue("<div>aperçu</div>");
    render(<ThemePickerRail {...baseProps({ renderPreview })} />);

    expect(renderPreview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));

    // Toggle label persists in the expanded state.
    expect(screen.getByText("Thème : Modern Sidebar")).not.toBeNull();

    for (const theme of themes) {
      expect(screen.getByText(theme.label)).not.toBeNull();
    }

    await waitFor(() => expect(renderPreview).toHaveBeenCalledTimes(3));
    for (const theme of themes) {
      expect(renderPreview).toHaveBeenCalledWith(theme.id, resume);
    }
  });

  it("clicking the toggle again collapses the grid back to toggle-only, label still present (AC-3)", async () => {
    render(<ThemePickerRail {...baseProps()} />);

    const toggle = screen.getByText("Thème : Modern Sidebar");
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText("Professional")).not.toBeNull());

    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));

    expect(screen.getByText("Thème : Modern Sidebar")).not.toBeNull();
    expect(screen.queryByText("Professional")).toBeNull();
    expect(screen.queryByText("Simple")).toBeNull();
  });

  it("each thumbnail renders the resolved preview HTML once renderPreview resolves (AC-4)", async () => {
    render(<ThemePickerRail {...baseProps()} />);
    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));

    await waitFor(() => {
      expect(screen.getByTitle("Aperçu Modern Sidebar")).not.toBeNull();
      expect(screen.getByTitle("Aperçu Professional")).not.toBeNull();
      expect(screen.getByTitle("Aperçu Simple")).not.toBeNull();
    });
  });

  it("clicking a non-selected thumbnail calls onSelectTheme with that theme's id (AC-5)", async () => {
    const onSelectTheme = vi.fn();
    render(<ThemePickerRail {...baseProps({ onSelectTheme })} />);
    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));

    await waitFor(() => expect(screen.getByText("Professional")).not.toBeNull());

    fireEvent.click(screen.getByText("Professional"));
    expect(onSelectTheme).toHaveBeenCalledWith("professional");
  });

  it("disables the toggle so it cannot be expanded while disabled is true (AC-12)", () => {
    render(<ThemePickerRail {...baseProps({ disabled: true })} />);

    const toggle = screen.getByText("Thème : Modern Sidebar").closest("button");
    expect(toggle?.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));
    // Native disabled buttons don't fire onClick; the grid stays unmounted.
    expect(screen.queryByText("Professional")).toBeNull();
  });

  it("disables the thumbnails (no onSelectTheme) once disabled becomes true while the grid is already expanded (AC-12)", async () => {
    const onSelectTheme = vi.fn();
    const { rerender } = render(
      <ThemePickerRail {...baseProps({ onSelectTheme, disabled: false })} />,
    );
    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));
    await waitFor(() => expect(screen.getByText("Professional")).not.toBeNull());
    // Flush the initial preview-render effects before rerendering so the
    // subsequent state update below isn't racing with pending promises.
    await waitFor(() => expect(screen.getByTitle("Aperçu Professional")).not.toBeNull());

    await act(async () => {
      rerender(
        <ThemePickerRail
          {...baseProps({ onSelectTheme, disabled: true })}
        />,
      );
    });

    const professionalButton = screen
      .getByText("Professional")
      .closest("button");
    expect(professionalButton?.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("Professional"));
    expect(onSelectTheme).not.toHaveBeenCalled();
  });

  it("isolates a single failing thumbnail: only that theme shows an inline error while the others keep rendering/remain selectable (AC-13)", async () => {
    const onSelectTheme = vi.fn();
    const renderPreview = vi.fn((themeName: string) => {
      if (themeName === "professional") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve(`<div>aperçu ${themeName}</div>`);
    });
    render(
      <ThemePickerRail
        {...baseProps({ renderPreview, onSelectTheme })}
      />,
    );
    fireEvent.click(screen.getByText("Thème : Modern Sidebar"));

    await waitFor(() => expect(renderPreview).toHaveBeenCalledTimes(3));

    // The failing theme's thumbnail shows the inline error only within its
    // own card, and no iframe for it.
    const professionalCard = screen.getByText("Professional").closest("button") as HTMLElement;
    await waitFor(() =>
      expect(within(professionalCard).getByText("Aperçu indisponible")).not.toBeNull(),
    );
    expect(within(professionalCard).queryByTitle("Aperçu Professional")).toBeNull();

    // The other two thumbnails keep rendering their preview independently.
    await waitFor(() => {
      expect(screen.getByTitle("Aperçu Modern Sidebar")).not.toBeNull();
      expect(screen.getByTitle("Aperçu Simple")).not.toBeNull();
    });

    // The failing thumbnail's siblings remain selectable.
    fireEvent.click(screen.getByText("Simple"));
    expect(onSelectTheme).toHaveBeenCalledWith("simple");

    // The failing thumbnail itself also remains clickable/selectable (only
    // its preview failed, not its interactivity).
    fireEvent.click(screen.getByText("Professional"));
    expect(onSelectTheme).toHaveBeenCalledWith("professional");
  });

  it("shows a check badge on the currently selected theme's thumbnail", async () => {
    render(<ThemePickerRail {...baseProps({ selectedTheme: "professional" })} />);
    fireEvent.click(screen.getByText("Thème : Professional"));

    await waitFor(() => expect(screen.getByText("Modern Sidebar")).not.toBeNull());

    const selectedCard = screen
      .getByText("Professional")
      .closest("button") as HTMLElement;
    expect(selectedCard.querySelector("svg")).not.toBeNull();
  });
});
