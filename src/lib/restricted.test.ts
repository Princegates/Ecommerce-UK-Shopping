import { describe, expect, it } from "vitest";
import { linkWords, restrictedReason } from "./restricted";

describe("restricted items", () => {
  it("catches TENS and EMS muscle stimulators, including foot massagers", () => {
    expect(restrictedReason("EMS Foot Massager Mat Electric Muscle Stimulator")).toMatch(/muscle stimulator/);
    expect(restrictedReason("TENS Machine Pain Relief Unit, 24 modes")).toMatch(/muscle stimulator/);
    expect(restrictedReason("Electrical muscle stimulation pads")).toMatch(/muscle stimulator/);
    expect(restrictedReason("Foot massager", "TENS")).toMatch(/muscle stimulator/);
  });
  it("catches powered massage machines", () => {
    expect(restrictedReason("Shiatsu Neck and Back Massager with Heat")).toBe("powered massage device");
    expect(restrictedReason("Deep Tissue Percussion Massage Gun")).toBe("powered massage device");
    expect(restrictedReason("Full Body Massage Chair, zero gravity")).toBe("powered massage device");
    expect(restrictedReason("Rechargeable foot massager machine with kneading")).toBe("powered massage device");
    expect(restrictedReason("Professional massage machine")).toBe("powered massage device");
  });
  it("leaves ordinary goods alone", () => {
    for (const n of ["Cloud Runner Trainers", "Massage oil 100ml, lavender", "Wooden foot roller", "Sports massage towel", "Pack of ITEMS, tens of them", "Kettle 1.7L", "Tennis shoes", "Digital Air Fryer, 5L"]) {
      expect(restrictedReason(n)).toBeNull();
    }
    expect(restrictedReason(null, undefined, "")).toBeNull();
  });
  it("reads the words of a shop link", () => {
    expect(linkWords("https://www.amazon.co.uk/Foot-Massager-EMS-TENS/dp/B0ABC12345")).toContain("Foot Massager EMS TENS");
    expect(restrictedReason(linkWords("https://www.amazon.co.uk/Foot-Massager-EMS-TENS/dp/B0ABC12345"))).not.toBeNull();
    expect(linkWords("not a url")).toBe("");
  });
});
