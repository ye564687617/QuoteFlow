import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseProductImport } from "@/lib/product-import";

async function workbook(rows: Record<string, string>[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Products");
  const headers = Object.keys(rows[0]);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(headers.map((header) => row[header] ?? ""));
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function workbookWithEmbeddedImage() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Products");
  sheet.addRow(["Item Number ", "Color", " Description", "Unit"]);
  sheet.addRow(["SJ-EMBEDDED", "RGB", "Embedded image product", "pcs"]);
  const imageId = book.addImage({ extension: "png", base64: `data:image/png;base64,${Buffer.from("embedded-image").toString("base64")}` });
  sheet.addImage(imageId, { tl: { col: 1, row: 1 }, ext: { width: 50, height: 50 } });
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe("product import", () => {
  it("reads required fields and matches an image by P/N", async () => {
    const zip = new AdmZip();
    zip.addFile("photos/SJ-100.png", Buffer.from("image"));
    const result = await parseProductImport(await workbook([{ "P/N": "SJ-100", Description: "Pixel light", Unit: "pcs", Voltage: "12V" }]), zip.toBuffer());
    expect(result.records[0]).toMatchObject({ pn: "SJ-100", description: "Pixel light", unit: "pcs", imageEntryName: "photos/SJ-100.png", errors: [], attributes: { Voltage: "12V" } });
  });

  it("reports missing required values", async () => {
    const result = await parseProductImport(await workbook([{ "P/N": "SJ-101", Description: "", Unit: "" }]));
    expect(result.records[0].errors).toEqual(["缺少 Description", "缺少 Unit"]);
  });

  it("keeps the first duplicate P/N and marks later rows to skip", async () => {
    const result = await parseProductImport(await workbook([
      { "P/N": "SJ-102", Description: "First", Unit: "pcs" },
      { "P/N": " sj-102 ", Description: "Second", Unit: "pcs" },
    ]));
    expect(result.records.map((record) => ({ duplicate: record.duplicate, errors: record.errors }))).toEqual([
      { duplicate: false, errors: [] },
      { duplicate: true, errors: [] },
    ]);
  });

  it("accepts the legacy Item Number header and reads an embedded workbook image", async () => {
    const result = await parseProductImport(await workbookWithEmbeddedImage());
    expect(result.records[0]).toMatchObject({
      rowNumber: 2,
      pn: "SJ-EMBEDDED",
      description: "Embedded image product",
      unit: "pcs",
      imageEntryName: "embedded-row-2.png",
      attributes: { Color: "RGB" },
      errors: [],
    });
    expect(result.records[0].imageBytes?.toString()).toBe("embedded-image");
  });

  it("finds a product header below title rows", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Catalogue");
    sheet.addRow(["Product catalogue"]);
    sheet.addRow([]);
    sheet.addRow(["Item Number", "Description", "Unit"]);
    sheet.addRow(["SJ-200", "Pixel module", "pcs"]);
    const result = await parseProductImport(Buffer.from(await book.xlsx.writeBuffer()));
    expect(result.records[0]).toMatchObject({ rowNumber: 4, pn: "SJ-200", description: "Pixel module", unit: "pcs", errors: [] });
  });
});
