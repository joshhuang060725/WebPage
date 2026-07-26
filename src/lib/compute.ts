import { add, det, evaluate, format, inv, multiply, transpose } from "mathjs";

export type MatrixOperation = "add" | "multiply" | "det" | "inverse" | "transpose";

export function evaluateExpression(expression: string): string {
  const normalized = expression.trim();
  if (!normalized) throw new Error("Expression is required.");
  if (
    /[;{}[\]=:]|__|prototype|constructor|import|evaluate|parse|compile|simplify/i.test(
      normalized
    )
  ) {
    throw new Error("Assignments, object access, and dynamic imports are not allowed.");
  }
  const withoutStrings = normalized.replace(/(['"]).*?\1/g, "");
  const identifiers = withoutStrings.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const allowed = new Set([
    "sqrt", "sin", "cos", "tan", "asin", "acos", "atan", "abs", "log", "log10",
    "exp", "pow", "round", "floor", "ceil", "min", "max", "mean", "median", "std",
    "derivative", "unit", "pi", "e", "i"
  ]);
  const unknown = identifiers.find((identifier) => !allowed.has(identifier));
  if (unknown) throw new Error(`Unsupported identifier: ${unknown}`);
  return format(evaluate(normalized), { precision: 14 });
}

export function parseMatrixInput(input: string): number[][] {
  const parsed = JSON.parse(input);
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((value) => typeof value === "number" && Number.isFinite(value))
    )
  ) {
    throw new Error("Matrix must be a nested JSON array of finite numbers.");
  }
  const width = parsed[0].length;
  if (!parsed.every((row) => row.length === width)) {
    throw new Error("All matrix rows must have the same length.");
  }
  return parsed;
}

export function runMatrixOperation(
  operation: MatrixOperation,
  aInput: string,
  bInput = ""
): string {
  const a = parseMatrixInput(aInput);
  const b = ["add", "multiply"].includes(operation) ? parseMatrixInput(bInput) : null;
  const result =
    operation === "add"
      ? add(a, b!)
      : operation === "multiply"
        ? multiply(a, b!)
        : operation === "det"
          ? det(a)
          : operation === "inverse"
            ? inv(a)
            : transpose(a);
  return format(result, { precision: 12 });
}

export function parseChartRows(input: string): [number, number][] {
  const rows = input
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const values = line.split(",").map((value) => Number(value.trim()));
      if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) {
        throw new Error(`Invalid row ${index + 1}.`);
      }
      return values as [number, number];
    });
  if (rows.length < 2) throw new Error("Provide at least two rows.");
  return rows;
}

export function convertCurrency(
  amount: number,
  base: string,
  quote: string,
  rates: Record<string, number>
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a finite non-negative number.");
  }
  if (!rates[base] || !rates[quote]) throw new Error("Currency unavailable.");
  return amount * (rates[quote] / rates[base]);
}
