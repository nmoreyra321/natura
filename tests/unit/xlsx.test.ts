import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildXlsx } from "@/lib/xlsx";

describe("buildXlsx", () => {
  it("arma un zip con las hojas", () => {
    const bytes = buildXlsx([
      { name: "Productos", rows: [["Nombre", "Precio"], ["Crema & <Ekos>", 1234.5], ["Con tilde ñ", null]] },
      { name: "Productos", rows: [["x"]] },
    ]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("xl/worksheets/sheet2.xml");
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes);
  });
});
