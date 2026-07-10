/**
 * Tier 3 — renderer component.
 * See tests/TEST_PLAN.md → "Tier 3: ThemeToggle".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders the three French labels (AC8)", () => {
    render(<ThemeToggle mode="system" onModeChange={vi.fn()} />);

    expect(screen.queryByText("Clair")).not.toBeNull();
    expect(screen.queryByText("Sombre")).not.toBeNull();
    expect(screen.queryByText("Système")).not.toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("renders an icon inside each of the three buttons (AC8)", () => {
    const { container } = render(
      <ThemeToggle mode="system" onModeChange={vi.fn()} />,
    );

    // lucide-react renders each icon as an inline <svg>.
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button.querySelector("svg")).not.toBeNull();
    }
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });

  it("marks the current mode as pressed", () => {
    render(<ThemeToggle mode="dark" onModeChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /Sombre/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Clair/ }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /Système/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("marks Système as pressed for the first-run default mode (AC1/AC8)", () => {
    render(<ThemeToggle mode="system" onModeChange={vi.fn()} />);

    expect(
      screen
        .getByRole("button", { name: /Système/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Clair/ }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: /Sombre/ }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("calls onModeChange with the clicked value", () => {
    const onModeChange = vi.fn();
    render(<ThemeToggle mode="system" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Clair/ }));
    expect(onModeChange).toHaveBeenCalledWith("light");

    fireEvent.click(screen.getByRole("button", { name: /Sombre/ }));
    expect(onModeChange).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByRole("button", { name: /Système/ }));
    expect(onModeChange).toHaveBeenCalledWith("system");
  });
});
