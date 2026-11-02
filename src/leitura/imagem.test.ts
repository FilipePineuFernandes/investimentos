import { describe, expect, it } from "vitest";
import { realcarContraste } from "./imagem";

const pixel = (r: number, g: number, b: number) => [r, g, b, 255];
const dados = (pixeis: number[][]) => new Uint8ClampedArray(pixeis.flat());

describe("contraste da fotografia", () => {
  it("passa a cinzento: os três canais ficam iguais e o alfa a 255", () => {
    const d = dados([pixel(200, 30, 30), pixel(10, 10, 10), pixel(250, 250, 250), pixel(120, 130, 140)]);
    realcarContraste(d);
    for (let i = 0; i < 4; i++) {
      expect(d[i * 4]).toBe(d[i * 4 + 1]);
      expect(d[i * 4 + 1]).toBe(d[i * 4 + 2]);
      expect(d[i * 4 + 3]).toBe(255);
    }
  });

  it("estica o contraste: papel acinzentado fica branco e tinta fica preta", () => {
    // 100 pixéis: 20 de tinta (cinzento 60), 80 de papel (cinzento 180).
    const d = dados([...Array(20).fill(pixel(60, 60, 60)), ...Array(80).fill(pixel(180, 180, 180))]);
    realcarContraste(d);
    expect(d[0]).toBe(0);
    expect(d[20 * 4]).toBe(255);
  });

  it("uma imagem de uma só cor não rebenta", () => {
    const d = dados(Array(50).fill(pixel(100, 100, 100)));
    expect(() => realcarContraste(d)).not.toThrow();
    expect(d[3]).toBe(255);
  });
});
