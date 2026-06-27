import { PDFDocument } from "pdf-lib";
import { convertPdfToPdfA3, type PdfA3ConversionResult } from "./pdfa-converter";
import { validateZugferdPdfA3, type ZugferdPdfValidationResult } from "./zugferd-validator";

export type ZugferdPdfBuildResult = {
  pdfBytes: Buffer | null;
  conversion: PdfA3ConversionResult;
  validation: ZugferdPdfValidationResult | null;
};

export async function buildValidatedZugferdPdf(input: {
  invoicePdfBytes: Buffer;
  xrechnungXml: Buffer;
}): Promise<ZugferdPdfBuildResult> {
  const conversion = await convertPdfToPdfA3(input.invoicePdfBytes);
  if (!conversion.converted || !conversion.pdfBytes) {
    return {
      pdfBytes: null,
      conversion,
      validation: null,
    };
  }

  const pdfDoc = await PDFDocument.load(conversion.pdfBytes);
  await pdfDoc.attach(input.xrechnungXml, "factur-x.xml", {
    mimeType: "application/xml",
    description: "ZUGFeRD-Rechnungsdaten",
    afRelationship: "Alternative" as never,
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  pdfDoc.setProducer("WorkPilot360");
  pdfDoc.setCreator("WorkPilot360");

  const zugferdPdfBytes = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  const validation = await validateZugferdPdfA3(zugferdPdfBytes);
  return {
    pdfBytes: validation.valid ? zugferdPdfBytes : null,
    conversion,
    validation,
  };
}
