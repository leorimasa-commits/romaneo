
import { GoogleGenAI, Type } from "@google/genai";
import { ColumnDef, FieldType, Permiso, Remito } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

export const generateMockData = async (
  columns: ColumnDef[], 
  count: number = 5, 
  context: 'permisos' | 'remitos', 
  existingPermitIds: string[] = []
): Promise<any[]> => {
  
  let prompt = "";
  
  if (context === 'permisos') {
    prompt = `Generate ${count} rows of realistic Citrus Shipment Permits (Permisos de Embarque - AFIP Form OM-1993) from Argentina.
    Fields: 
    - exportador (e.g. CAUQUEN ARGENTINA S. A. U., SAN MIGUEL, CITROMAX)
    - numeroPermiso (format strictly: YY NNN EC01 NNNNNN D, e.g. 24008EC01003313D). Can be same permit multiple items.
    - fechaOficializacion (Recent 2024 dates)
    - paisDestino (RUSIA, ESTADOS UNIDOS, ESPAÑA)
    - vapor (Ship names like ORIENTAL REEFER, MSC ADONIS)
    - item (0001, 0002, 0003)
    - subItem (A, B, C or -)
    - producto (LIMONES, NARANJAS)
    - variedad (EUREKA, VALENCIA, MURCOTT)
    - marca (CAUQUEN, MAITEN, CRISTA, BOLLO)
    - contramarca (Optional: PREMIUM, STANDARD, or leave empty)
    - bultos (Pallets count: 20-22)
    - cajas (Box count: 1200-2400)
    - netoUnitario (15-20)
    - brutoUnitario (16-22)`;
  } else {
    prompt = `Generate ${count} rows of Citrus Delivery Notes (Remitos).
    Fields: 
    - numeroRemito (R-0001-XXXXX)
    - fecha (recent dates 2024)
    - permisoId
    - marca (should match typical citrus brands)
    - contramarca (optional, e.g. PREMIUM, STANDARD or empty)
    - pallets (integer 18-24)
    - cajas (integer 1000-1500)
    - kiloNeto (number 20000-25000)
    - kiloBruto (number 22000-28000)
    
    CRITICAL: The 'permisoId' MUST be strictly selected from this list of VALID IDs: ${JSON.stringify(existingPermitIds)}.
    Do not invent IDs. Use the ones provided randomly.`;
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          // Exclude readonly AND calculated fields from AI generation (we calculate them later)
          properties: columns.filter(c => !c.readonly && !c.calculated).reduce((acc, col) => {
            let type = Type.STRING;
            if (col.type === FieldType.NUMBER) type = Type.NUMBER;
            acc[col.key] = { type };
            return acc;
          }, {} as Record<string, any>)
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const extractPermisoFromPdf = async (base64Pdf: string): Promise<any[]> => {
  const prompt = `
  You are an expert data extraction assistant for Argentine Customs Documents (OM-1993 Permiso de Embarque).
  
  Analyze the provided PDF document. It may contain multiple pages and multiple items (Item 0001, 0002, etc.).
  Extract the data for EACH Item found in the document into a JSON Array.
  
  Map the data to the following keys:
  - exportador: The Exporter name (Importador/Exportador box).
  - numeroPermiso: The registration number (e.g., 24 008 EC01 ...). Remove spaces if possible (e.g. 24008EC01...).
  - fechaOficializacion: The date of "Oficialización". Convert strictly to ISO format YYYY-MM-DD.
  - paisDestino: "Pais dest."
  - vapor: "Nombre del Transporte" or "Vapor".
  - item: The Item Number (e.g., "0001", "0002").
  - subItem: The Subitem letter if available (e.g., "A", "B"), otherwise "-".
  - producto: Extract from the Description (e.g., LIMONES, NARANJAS).
  - variedad: Extract from Description if visible (e.g., EUREKA), otherwise generic.
  - marca: Extract "Marcas y Numeros" or brand from text.
  - bultos: "Total Bultos" for the specific item if listed, or general. Number.
  - cajas: "Cantidad Unidades" (This is usually the box count). Number.
  - netoUnitario: "Unitario en Divisa" or calculate (Total Net / Quantity). Number.
  - brutoUnitario: Calculate (Total Gross / Quantity) or estimate. Number.

  Return ONLY the JSON Array.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Pdf
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            exportador: { type: Type.STRING },
            numeroPermiso: { type: Type.STRING },
            fechaOficializacion: { type: Type.STRING },
            paisDestino: { type: Type.STRING },
            vapor: { type: Type.STRING },
            item: { type: Type.STRING },
            subItem: { type: Type.STRING },
            producto: { type: Type.STRING },
            variedad: { type: Type.STRING },
            marca: { type: Type.STRING },
            bultos: { type: Type.NUMBER },
            cajas: { type: Type.NUMBER },
            netoUnitario: { type: Type.NUMBER },
            brutoUnitario: { type: Type.NUMBER },
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const extractRemitoFromPdf = async (base64Pdf: string): Promise<any[]> => {
  const prompt = `
  Analyze this Argentine Citrus Delivery Note (Remito).
  Extract the following data into a JSON Array (it might contain one or multiple delivery notes in the same PDF).
  
  Fields to extract:
  - exportador: Name of the company issuing the remito.
  - numeroRemito: The delivery note number (e.g., R-0005-00012345).
  - fecha: Date of issue (YYYY-MM-DD).
  - numeroPermiso: Look for references to "Permiso de Embarque" or "SIM" number (e.g., 24 008 EC01 ...).
  - itemPermiso: Item number mentioned near the permit reference.
  - subItemPermiso: Subitem letter if available.
  - marca: Brand of the fruit.
  - contramarca: Sub-brand or additional brand info if available.
  - pallets: Number of pallets (bultos).
  - cajas: Number of boxes (unidades/cajas).
  - kiloNeto: Total net weight if visible.
  - kiloBruto: Total gross weight if visible.

  Return ONLY the JSON Array.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Pdf
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            exportador: { type: Type.STRING },
            numeroRemito: { type: Type.STRING },
            fecha: { type: Type.STRING },
            numeroPermiso: { type: Type.STRING },
            itemPermiso: { type: Type.STRING },
            subItemPermiso: { type: Type.STRING },
            marca: { type: Type.STRING },
            contramarca: { type: Type.STRING },
            pallets: { type: Type.NUMBER },
            cajas: { type: Type.NUMBER },
            kiloNeto: { type: Type.NUMBER },
            kiloBruto: { type: Type.NUMBER },
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const analyzeCitrusData = async (permisos: Permiso[], remitos: Remito[]): Promise<string> => {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Analyze this citrus export data.
    Permits (Budget/Quotas with Items): ${JSON.stringify(permisos)}
    Remitos (Actual Shipments linked to permits): ${JSON.stringify(remitos)}
    
    Provide a concise executive summary:
    1. Exporter activity analysis.
    2. Fulfillment: Compare 'Kilos Brutos' in Permits vs 'Kilo Bruto' sum in Remitos.
    3. Average efficiency (Kg per Pallet).
    `,
  });
  return response.text || "No analysis available.";
};
