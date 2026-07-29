import path from "node:path";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { normalizePn } from "@/lib/validation";
import { normalizeDescription, parseRegularPrice } from "@/lib/product-variants";

export type ImportRecord = {
  rowNumber: number;
  pn: string;
  name: string;
  description: string;
  unit: string;
  regularPriceUsd: string;
  requestedImage: string;
  imageEntryName: string | null;
  imageBytes: Buffer | null;
  attributes: Record<string, string | number | boolean>;
  errors: string[];
  duplicate: boolean;
};

type EmbeddedImage = { filename: string; bytes: Buffer };

const PN_HEADERS = ["pn", "p/n", "partnumber", "partno", "itemnumber", "itemno", "model", "modelnumber"];
const DESCRIPTION_HEADERS = ["description", "productdescription"];
const UNIT_HEADERS = ["unit", "uom"];
const recognized = new Set([
  ...PN_HEADERS,
  ...DESCRIPTION_HEADERS,
  ...UNIT_HEADERS,
  "item",
  "name",
  "productname",
  "category",
  "regularprice",
  "unitprice",
  "unitpriceusd",
  "priceusd",
  "imagefile",
  "image",
  "photo",
]);
const normalizedHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_./-]+/g, "");

function valueFrom(row: Record<string, unknown>, names: string[]) {
  const normalizedNames = names.map(normalizedHeader);
  for (const [key, value] of Object.entries(row)) {
    if (normalizedNames.includes(normalizedHeader(key))) return String(value ?? "").trim();
  }
  return "";
}

function findProductSheet(workbook: ExcelJS.Workbook) {
  for (const worksheet of workbook.worksheets) {
    const limit = Math.min(worksheet.rowCount, 30);
    for (let rowNumber = 1; rowNumber <= limit; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const headers = Array.from({ length: row.cellCount }, (_, index) => normalizedHeader(row.getCell(index + 1).text));
      const matches = PN_HEADERS.some((name) => headers.includes(normalizedHeader(name)))
        && DESCRIPTION_HEADERS.some((name) => headers.includes(normalizedHeader(name)))
        && UNIT_HEADERS.some((name) => headers.includes(normalizedHeader(name)));
      if (matches) return { worksheet, headerRow: rowNumber };
    }
  }
  throw new Error("找不到产品表头，请确认包含 P/N（或 Item Number）、Description 和 Unit 列");
}

function embeddedImagesByRow(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, headerRow: number) {
  const result = new Map<number, EmbeddedImage>();
  for (const placedImage of worksheet.getImages()) {
    const image = workbook.getImage(Number(placedImage.imageId));
    let bytes: Buffer | null = null;
    if (image.buffer) bytes = Buffer.from(image.buffer);
    else if (image.base64) bytes = Buffer.from(image.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!bytes || bytes.length > 12 * 1024 * 1024) continue;
    let rowNumber = placedImage.range.tl.nativeRow + 1;
    // Some older workbooks place the first product image partly inside the header row.
    if (rowNumber <= headerRow) rowNumber = headerRow + 1;
    if (!result.has(rowNumber)) {
      const extension = image.extension === "jpeg" ? "jpg" : image.extension;
      result.set(rowNumber, { filename: `embedded-row-${rowNumber}.${extension}`, bytes });
    }
  }
  return result;
}

export async function parseProductImport(workbookBytes: Buffer, zipBytes?: Buffer | null): Promise<{ records: ImportRecord[]; zip: AdmZip | null }> {
  if (workbookBytes.length > 20 * 1024 * 1024) throw new Error("Excel 文件不能超过 20MB");
  if (zipBytes && zipBytes.length > 150 * 1024 * 1024) throw new Error("图片 ZIP 不能超过 150MB");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(workbookBytes as never);
  } catch {
    throw new Error("Excel 文件无法读取，请上传有效的 .xlsx 文件");
  }
  const { worksheet, headerRow } = findProductSheet(workbook);
  const header = worksheet.getRow(headerRow);
  const headers = Array.from({ length: header.cellCount }, (_, index) => header.getCell(index + 1).text.trim());
  const embeddedImages = embeddedImagesByRow(workbook, worksheet, headerRow);

  const zip = zipBytes ? new AdmZip(zipBytes) : null;
  const entries = (zip?.getEntries() ?? []).filter((entry) => !entry.isDirectory);
  if (entries.length > 500) throw new Error("ZIP 中的文件不能超过 500 个");
  const allowedEntries = entries.filter((entry) => /\.(jpe?g|png|webp)$/i.test(entry.entryName) && entry.header.size <= 12 * 1024 * 1024);
  const byBasename = new Map(allowedEntries.map((entry) => [path.posix.basename(entry.entryName).toLowerCase(), entry]));
  const byStem = new Map(allowedEntries.map((entry) => [normalizePn(path.posix.basename(entry.entryName, path.posix.extname(entry.entryName))), entry]));

  const records: ImportRecord[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const excelRow = worksheet.getRow(rowNumber);
    const values = headers.map((_, index) => excelRow.getCell(index + 1).text.trim());
    if (!values.some(Boolean)) continue;
    const row = Object.fromEntries(headers.map((column, index) => [column || `Column ${index + 1}`, values[index]]));
    const pn = valueFrom(row, PN_HEADERS);
    const description = valueFrom(row, DESCRIPTION_HEADERS);
    const unit = valueFrom(row, UNIT_HEADERS);
    const requestedImage = valueFrom(row, ["imagefile", "image", "photo"]);
    const externalEntry = requestedImage
      ? byBasename.get(path.posix.basename(requestedImage).toLowerCase())
      : pn ? byStem.get(normalizePn(pn)) : undefined;
    const embeddedImage = embeddedImages.get(rowNumber);
    const selectedImage = externalEntry
      ? { filename: externalEntry.entryName, bytes: externalEntry.getData() }
      : embeddedImage;
    const errors: string[] = [];
    if (!pn) errors.push("缺少 P/N");
    if (!description) errors.push("缺少 Description");
    if (!unit) errors.push("缺少 Unit");
    if (parseRegularPrice(valueFrom(row, ["regularprice", "unitprice", "unitpriceusd", "priceusd"])) === null) errors.push("常规单价格式不正确");
    if (requestedImage && !selectedImage) errors.push(`找不到图片 ${requestedImage}`);
    const attributes = Object.fromEntries(Object.entries(row)
      .filter(([key, value]) => !recognized.has(normalizedHeader(key)) && value !== "" && value !== null)
      .map(([key, value]) => [key.trim(), value as string | number | boolean]));
    records.push({
      rowNumber,
      pn,
      name: valueFrom(row, ["name", "productname"]),
      description,
      unit,
      regularPriceUsd: valueFrom(row, ["regularprice", "unitprice", "unitpriceusd", "priceusd"]),
      requestedImage,
      imageEntryName: selectedImage?.filename ?? null,
      imageBytes: selectedImage?.bytes ?? null,
      attributes,
      errors,
      duplicate: false,
    });
  }
  if (records.length > 1000) throw new Error("单次最多导入 1000 个产品");

  const seenIdentities = new Set<string>();
  for (const record of records) {
    if (!record.pn || !record.description) continue;
    const key = `${normalizePn(record.pn)}:${normalizeDescription(record.description)}`;
    if (seenIdentities.has(key)) record.duplicate = true;
    else seenIdentities.add(key);
  }
  return { records, zip };
}

export function imageMime(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
}
