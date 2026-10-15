import { describe, expect, it } from "vitest";

import { campaignSlug, isActive, PRESETS, presetFor } from "@/lib/campaigns";

const preset = (title: string) => PRESETS.find((p) => p.title === title)!;

describe("fechas especiales", () => {
  it("Día de la Madre es el tercer domingo de octubre", () => {
    expect(presetFor(preset("Día de la Madre"), "2026-10-01")).toMatchObject({ starts_on: "2026-10-03", ends_on: "2026-10-18" });
  });
  it("si ya pasó este año, propone el del año que viene", () => {
    expect(presetFor(preset("Día de la Madre"), "2026-10-19").ends_on).toBe("2027-10-17");
    expect(presetFor(preset("Día del Padre"), "2026-10-15").ends_on).toBe("2027-06-20");
  });
  it("está activa entre las fechas, incluidas", () => {
    const c = { starts_on: "2026-10-03", ends_on: "2026-10-18" };
    expect(isActive(c, "2026-10-03")).toBe(true);
    expect(isActive(c, "2026-10-18")).toBe(true);
    expect(isActive(c, "2026-10-19")).toBe(false);
  });
  it("arma la dirección de la página", () => {
    expect(campaignSlug("💐 Día de la Madre", "2026-10-03")).toBe("dia-de-la-madre-2026");
  });
});
