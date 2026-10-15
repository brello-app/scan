import Papa from "papaparse";
import { normalize, type ParseResult } from "./data-normalizer";

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => resolve(normalize(data, meta.fields ?? [])),
      error: (err) =>
        resolve({ ok: false, error: `Couldn't read the file: ${err.message}` }),
    });
  });
}

// For the "Try with sample data" button: put the sample CSV in public/sample/
export async function parseCsvUrl(url: string): Promise<ParseResult> {
  const text = await fetch(url).then((r) => r.text());
  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return normalize(data, meta.fields ?? []);
}
