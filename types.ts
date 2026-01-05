

export enum FieldType {
  STRING = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select'
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  type: FieldType;
  options?: (string | SelectOption)[]; // Supports simple strings or value/label pairs
  placeholder?: string;
  readonly?: boolean; // Prevent editing in forms
  calculated?: boolean; // New: Show in form but disabled (auto-calculated)
  optional?: boolean; // New: Field is not required
}

export interface Permiso {
  id: string;
  exportador: string; 
  numeroPermiso: string; // "24 008 EC01..."
  fechaOficializacion: string; // New: From "Oficialización"
  paisDestino: string; // New: From "Pais dest."
  vapor: string; // New: From "Nombre del Transporte"
  
  item: string;
  subItem: string;
  producto: string; 
  variedad: string;
  marca: string; 
  contramarca?: string; // Optional field
  
  bultos: number; // "Total Bultos" (Pallets usually)
  cajas: number; // "Cantidad Unidades"
  
  // Unit Weights (Internal for calculation)
  netoUnitario: number;
  brutoUnitario: number;
  
  // Totals Documented (Planned)
  kilosNetos: number; // "Total Kg. Neto"
  kilosBrutos: number; 

  // Totals Loaded (Real/Calculated from Remitos)
  cajasCargadas: number; // New: Sum of Remito boxes
  kilosNetosCargados: number; 
  kilosBrutosCargados: number;
}

export interface Remito {
  id: string;
  exportador: string; 
  numeroRemito: string;
  fecha: string;
  permisoId: string; 
  marca: string; 
  contramarca: string; 
  pallets: number;
  cajas: number;
  kiloNeto: number;
  kiloBruto: number;
}

// Union type for the generic table component
export type DataRow = Permiso | Remito | any;

export type ViewMode = 'permisos' | 'remitos' | 'dashboard';