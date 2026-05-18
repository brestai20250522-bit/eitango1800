import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultInput = path.join(os.homedir(), "Desktop", "英単語1800アプリ用リスト.xlsx");
const inputPath = path.resolve(process.cwd(), process.argv[2] ?? process.env.WORD_XLSX ?? defaultInput);
const outputPath = path.join(projectRoot, "src", "data", "words.json");

function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function findColumn(headers, label) {
  const index = headers.findIndex((header) => toText(header).includes(label));
  if (index === -1) {
    throw new Error(`Missing required column: ${label}`);
  }
  return index;
}

function buildWord(row, indexes) {
  const numberText = toText(row[indexes.number]);
  const unit = toText(row[indexes.unit]);
  const english = toText(row[indexes.english]);
  const japanese = toText(row[indexes.japanese]);

  if (!unit && !english && !japanese) {
    return null;
  }

  const number = Number(numberText);
  if (!Number.isFinite(number) || !unit || !english || !japanese) {
    throw new Error(`Invalid row for word number ${numberText || "(blank)"}`);
  }

  return {
    id: `word-${number}`,
    number,
    unit,
    english,
    japanese,
  };
}

async function main() {
  await fs.access(inputPath);
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const sheetName = workbook.SheetNames.includes("input") ? "input" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });

  if (rows.length < 2) {
    throw new Error("Workbook has no data rows.");
  }

  const headers = rows[0];
  const indexes = {
    number: findColumn(headers, "番号"),
    unit: findColumn(headers, "単元"),
    english: findColumn(headers, "英語"),
    japanese: findColumn(headers, "日本語"),
  };

  const words = rows.slice(1).map((row) => buildWord(row, indexes)).filter(Boolean);
  const ids = new Set(words.map((word) => word.id));
  if (ids.size !== words.length) {
    throw new Error("Duplicate word numbers detected.");
  }

  const units = new Set(words.map((word) => word.unit));
  await fs.writeFile(outputPath, `${JSON.stringify(words, null, 2)}\n`, "utf8");

  console.log(`Imported ${words.length} words from ${sheetName}.`);
  console.log(`Units: ${units.size}`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
