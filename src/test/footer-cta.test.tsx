import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "@/components/Footer";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Footer />
    </MemoryRouter>,
  );

const ctaBand = () => screen.queryByRole("heading", { name: "Start your investment journey today" });

afterEach(cleanup);

describe("Footer CTA band", () => {
  it("shows on ordinary pages", () => {
    renderAt("/");
    expect(ctaBand()).not.toBeNull();
  });

  it.each(["/open-account", "/contact"])("is hidden on %s, where it would link to the same page", (path) => {
    renderAt(path);
    expect(ctaBand()).toBeNull();
  });

  it("lists Investor Corner and Investor Charter once each, and no raw sitemap", () => {
    renderAt("/");
    expect(screen.getAllByRole("link", { name: /Investor Corner/ })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Investor Charter/ })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Sitemap/ })).toBeNull();
  });
});
