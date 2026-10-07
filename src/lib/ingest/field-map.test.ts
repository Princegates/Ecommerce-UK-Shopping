import { describe, expect, it } from "vitest";
import { formatFieldMap, parseFieldMap } from "./field-map";

describe("field map text", () => {
  it("round-trips known keys and drops the rest", () => {
    const m = parseFieldMap("name = product_title\nPRICE=cost.gbp\nbogus=x\n=y\ninclude=/product/, /p/\n\n");
    expect(m).toEqual({ name: "product_title", price: "cost.gbp", include: "/product/, /p/" });
    expect(parseFieldMap(formatFieldMap(m))).toEqual(m);
    expect(parseFieldMap("")).toEqual({});
  });
});
