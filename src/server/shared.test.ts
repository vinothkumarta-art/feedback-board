import { describe, expect, it } from "vitest";
import { customerPerson, memberPerson, rankSimilar } from "./shared";

describe("people", () => {
  it("keys customers by normalized email and members by id", () => {
    expect(customerPerson("Ana", "  Ana@Example.COM ").key).toBe(
      "e:ana@example.com",
    );
    expect(memberPerson({ id: "u1", email: "a@b.c" }).key).toBe("u:u1");
  });
});

describe("similar titles", () => {
  const titles = [
    { title: "Export reports to CSV" },
    { title: "Dark mode" },
    { title: "Slack alerts" },
  ];
  it("finds titles that share a word", () => {
    expect(rankSimilar("CSV export for invoices", titles)).toEqual([
      { title: "Export reports to CSV" },
    ]);
  });
  it("ignores short and common words", () => {
    expect(rankSimilar("add the to", titles)).toEqual([]);
  });
});
