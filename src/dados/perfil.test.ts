import { describe, expect, it } from "vitest";
import { descricaoComissao, PERFIL_VAZIO, problemaDataNascimento, quocienteDe, temCorretora } from "./perfil";

describe("data de nascimento", () => {
  const hoje = new Date(2026, 10, 2); // 2 de novembro de 2026

  it("aceita uma data normal", () => {
    expect(problemaDataNascimento("1985-03-12", hoje)).toBeNull();
  });

  it("pede a data quando está vazia ou incompleta", () => {
    expect(problemaDataNascimento("", hoje)).toContain("Indique");
    expect(problemaDataNascimento("1985-03", hoje)).toContain("Indique");
  });

  it("recusa datas que não existem", () => {
    expect(problemaDataNascimento("1985-02-30", hoje)).toContain("não existe");
    expect(problemaDataNascimento("1985-13-01", hoje)).toContain("não existe");
  });

  it("recusa datas no futuro e idades fora do normal", () => {
    expect(problemaDataNascimento("2027-01-01", hoje)).toContain("futuro");
    expect(problemaDataNascimento("2020-01-01", hoje)).toContain("fora do normal");
    expect(problemaDataNascimento("1900-01-01", hoje)).toContain("fora do normal");
  });

  it("aceita quem faz 16 anos hoje e recusa quem os faz amanhã", () => {
    expect(problemaDataNascimento("2010-11-02", hoje)).toBeNull();
    expect(problemaDataNascimento("2010-11-03", hoje)).toContain("fora do normal");
  });
});

describe("quociente familiar", () => {
  it("perfis antigos, sem o campo, contam como individual", () => {
    expect(quocienteDe(undefined)).toBe(1);
    expect(quocienteDe(null)).toBe(1);
    expect(quocienteDe({ ...PERFIL_VAZIO, quocienteFamiliar: undefined as unknown as number })).toBe(1);
    expect(quocienteDe({ ...PERFIL_VAZIO, quocienteFamiliar: 2 })).toBe(2);
  });
});

describe("corretora", () => {
  it("só conta como preenchida com um nome", () => {
    expect(temCorretora(undefined)).toBe(false);
    expect(temCorretora(PERFIL_VAZIO.corretora)).toBe(false);
    expect(temCorretora({ ...PERFIL_VAZIO.corretora, nome: "  " })).toBe(false);
    expect(temCorretora({ ...PERFIL_VAZIO.corretora, nome: "XTB" })).toBe(true);
  });
});

describe("comissão da corretora em palavras", () => {
  const base = { ...PERFIL_VAZIO.corretora, nome: "X" };

  it("junta a parte fixa e a percentual", () => {
    expect(descricaoComissao({ ...base, comissaoFixa: 2, comissaoPercentagem: 0.1 })).toBe("2 € + 0,1 % do valor");
    expect(descricaoComissao({ ...base, comissaoFixa: 1.5 })).toBe("1,5 €");
    expect(descricaoComissao({ ...base, comissaoPercentagem: 0.05 })).toBe("0,05 % do valor");
  });

  it("indica o mínimo e o máximo por ordem", () => {
    expect(descricaoComissao({ ...base, comissaoFixa: 1, comissaoPercentagem: 0.1, comissaoMinima: 5, comissaoMaxima: 10 })).toBe("1 € + 0,1 % do valor (mínimo 5 €, máximo 10 €)");
    expect(descricaoComissao({ ...base, comissaoFixa: 1, comissaoMaxima: 10 })).toBe("1 € (máximo 10 €)");
  });

  it("sem comissão preenchida diz isso, e perfis antigos sem mínimo nem máximo funcionam", () => {
    expect(descricaoComissao(base)).toBe("Sem comissão indicada");
    expect(descricaoComissao({ nome: "X", comissaoFixa: 2, comissaoPercentagem: null, cambioPercentagem: null })).toBe("2 €");
  });
});
