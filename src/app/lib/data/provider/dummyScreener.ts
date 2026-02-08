export const dummyScreener = {
  name: "DummyScreener",

  async fetchCanadianSymbol(): Promise<string[]> {
    return ["MON.V", "FDI.V", "EW.V", "QBAT.V", "WATR.V", "BFM.V", "HAN.V"];
  },
};
