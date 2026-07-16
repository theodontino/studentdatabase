import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlowSurface } from "@/components/ui";

describe("GlowSurface", () => {
  it("exposes semantic tone and only breathes when active", () => {
    const active = renderToString(<GlowSurface tone="attention" active breathe><section>关注</section></GlowSurface>);
    expect(active).toContain('data-glow-tone="attention"');
    expect(active).toContain("is-glow-active");
    expect(active).toContain("is-glow-breathing");

    const idle = renderToString(<GlowSurface tone="attendance" breathe><section>考勤</section></GlowSurface>);
    expect(idle).not.toContain("is-glow-active");
    expect(idle).not.toContain("is-glow-breathing");
  });
});
