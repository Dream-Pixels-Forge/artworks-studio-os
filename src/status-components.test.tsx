// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState, ErrorState, EmptyState } from "./renderer/ui/status-components.js";

describe("Status Components", () => {
  it("renders LoadingState with default message", () => {
    render(<LoadingState />);
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("renders LoadingState with custom message", () => {
    render(<LoadingState message="Fetching data..." />);
    expect(screen.getByText("Fetching data...")).toBeDefined();
  });

  it("renders ErrorState with message", () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders ErrorState with dismiss button", () => {
    let dismissed = false;
    render(<ErrorState message="Error" onDismiss={() => { dismissed = true; }} />);
    const dismiss = screen.getByText("×");
    dismiss.click();
    expect(dismissed).toBe(true);
  });

  it("renders EmptyState with message", () => {
    render(<EmptyState message="No items found" />);
    expect(screen.getByText("No items found")).toBeDefined();
  });
});
