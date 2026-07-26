import { describe, expect, it } from "vitest";
import {
  convertCurrency,
  evaluateExpression,
  parseChartRows,
  parseMatrixInput,
  runMatrixOperation
} from "../src/lib/compute";

describe("Compute Lab utilities", () => {
  it("evaluates expressions", () => {
    expect(evaluateExpression("sqrt(144) + 2")).toBe("14");
    expect(() => evaluateExpression("a = 7")).toThrow("Assignments");
    expect(() => evaluateExpression("import('x')")).toThrow("Assignments");
  });

  it("validates and calculates matrices", () => {
    expect(parseMatrixInput("[[1,2],[3,4]]")).toEqual([[1, 2], [3, 4]]);
    expect(runMatrixOperation("add", "[[1,2],[3,4]]", "[[5,6],[7,8]]")).toBe("[[6, 8], [10, 12]]");
    expect(runMatrixOperation("det", "[[1,2],[3,4]]")).toBe("-2");
  });

  it("rejects malformed chart rows", () => {
    expect(parseChartRows("1,2\n2,4")).toEqual([[1, 2], [2, 4]]);
    expect(() => parseChartRows("1,2\nbad")).toThrow("Invalid row 2");
  });

  it("converts cross-rates", () => {
    expect(convertCurrency(10, "USD", "TWD", { USD: 1, TWD: 32 })).toBe(320);
    expect(() => convertCurrency(-1, "USD", "TWD", { USD: 1, TWD: 32 })).toThrow();
  });
});
