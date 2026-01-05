
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, LayoutGrid, FileText, Container, Download, Trash2, Edit2, Bot, Save, Citrus, Copy, Upload, Loader2, ArrowLeft, ClipboardList } from 'lucide-react';
import { ColumnDef, Permiso, Remito, FieldType, ViewMode } from './types';
import { generateMockData, analyzeCitrusData, extractPermisoFromPdf, extractRemitoFromPdf } from './services/geminiService';
import { Button } from './components/Button';
import { Input, Select } from './components/Input';
import { Modal } from './components/Modal';
import { Dashboard } from './components/Dashboard';
import { BulkPasteModal } from './components/BulkPasteModal';
import { BulkPastePermisosModal } from './components/BulkPastePermisosModal';

// 1. Permiso Columns (Matched to AFIP Document Model)
export const PERMISO_COLUMNS: ColumnDef[] = [
  // Header Info
  { key: 'exportador', label: 'Exportador', type: FieldType.STRING, placeholder: 'CAUQUEN ARGENTINA S. A. U.' },
  { key: 'numeroPermiso', label: 'N° Permiso (SIM)', type: FieldType.STRING, placeholder: '24008EC01003313D' },
  { key: 'fechaOficializacion', label: 'Oficialización', type: FieldType.DATE },
  { key: 'paisDestino', label: 'País Destino', type: FieldType.STRING, placeholder: 'RUSIA' },
  { key: 'vapor', label: 'Vapor / Transporte', type: FieldType.STRING, placeholder: 'ORIENTAL REEFER' },
  
  // Item Info
  { key: 'item', label: 'Item', type: FieldType.STRING, placeholder: '0001' },
  { key: 'subItem', label: 'Sub Item', type: FieldType.STRING, placeholder: '-' },
  
  // Product Details
  { key: 'producto', label: 'Producto', type: FieldType.STRING, placeholder: 'LIMONES' },
  { key: 'variedad', label: 'Variedad', type: FieldType.STRING, placeholder: 'EUREKA' },
  { key: 'marca', label: 'Marca', type: FieldType.STRING, placeholder: 'CAUQUEN' },
  { key: 'contramarca', label: 'Contramarca', type: FieldType.STRING, placeholder: 'Opcional', optional: true },
  
  // Quantities & Commercial
  { key: 'bultos', label: 'Bultos (Pallets)', type: FieldType.NUMBER, placeholder: '20' },
  { key: 'cajas', label: 'Cant. Unidades (Cajas)', type: FieldType.NUMBER, placeholder: '6930' },

  // Weights (Unitary input -> Total calculated)
  { key: 'netoUnitario', label: 'Neto Unitario (kg)', type: FieldType.NUMBER, placeholder: '18.00' },
  { key: 'brutoUnitario', label: 'Bruto Unitario (kg)', type: FieldType.NUMBER, placeholder: '19.50' },
  
  // Totals Documented (Planned)
  { key: 'kilosNetos', label: 'Neto Documentado', type: FieldType.NUMBER, placeholder: 'Calculado autom.', calculated: true },
  { key: 'kilosBrutos', label: 'Bruto Documentado', type: FieldType.NUMBER, placeholder: 'Calculado autom.', calculated: true },

  // Totals Loaded (Real/Calculated from Remitos) - Virtual Columns
  { key: 'cajasCargadas', label: 'Cajas Cargadas', type: FieldType.NUMBER, readonly: true },
  { key: 'kilosNetosCargados', label: 'Neto Cargado (Real)', type: FieldType.NUMBER, readonly: true },
  { key: 'kilosBrutosCargados', label: 'Bruto Cargado (Real)', type: FieldType.NUMBER, readonly: true },
];

const App: React.FC = () => {
  // --- State ---
  const [viewMode, setViewMode] = useState<ViewMode>('remitos');
  
  // Data Stores
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false); // Remitos bulk
  const [isBulkPermisosModalOpen, setIsBulkPermisosModalOpen] = useState(false); // Permisos bulk
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear selection when changing views
  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewMode]);

  // --- Computed Columns for Remitos ---
  const remitoColumns: ColumnDef[] = useMemo(() => {
    return [
      // Changed from view_exportador to real field, calculated so it shows in form
      { key: 'exportador', label: 'Exportador', type: FieldType.STRING, calculated: true, placeholder: 'Se completa al elegir permiso' },
      
      { key: 'numeroRemito', label: 'N° Remito', type: FieldType.STRING, placeholder: 'R-000123' },
      { key: 'fecha', label: 'Fecha Ingreso', type: FieldType.DATE },

      // Added Producto and Variedad derived columns (Virtual)
      { key: 'view_producto', label: 'Producto', type: FieldType.STRING, readonly: true },
      { key: 'view_variedad', label: 'Variedad', type: FieldType.STRING, readonly: true },

      { 
        key: 'permisoId', 
        label: 'Asignar Permiso / Item', 
        type: FieldType.SELECT, 
        options: permisos.map(p => ({
          label: `${p.exportador} | ${p.numeroPermiso} | ${p.producto || ''} ${p.variedad || ''} | Item: ${p.item}/${p.subItem}`,
          value: p.id
        }))
      },
      
      { key: 'marca', label: 'Marca', type: FieldType.STRING, placeholder: 'Marca' },
      { key: 'contramarca', label: 'Contramarca', type: FieldType.STRING, placeholder: 'Contramarca (Opcional)', optional: true },

      // Virtual columns (Readonly, for display in table only)
      { key: 'view_item', label: 'Item', type: FieldType.STRING, readonly: true },
      { key: 'view_subItem', label: 'Sub Item', type: FieldType.STRING, readonly: true },
      
      // Physical columns
      { key: 'pallets', label: 'Pallets', type: FieldType.NUMBER, placeholder: '20' },
      { key: 'cajas', label: 'Cajas', type: FieldType.NUMBER, placeholder: '1200' },
      { key: 'kiloNeto', label: 'Kilo Neto', type: FieldType.NUMBER, placeholder: 'Calculado autom.', calculated: true },
      { key: 'kiloBruto', label: 'Kilo Bruto', type: FieldType.NUMBER, placeholder: 'Calculado autom.', calculated: true },
    ];
  }, [permisos]);

  // --- Totals Calculation ---
  const activeData = viewMode === 'permisos' ? permisos : remitos;
  const activeColumns = viewMode === 'permisos' ? PERMISO_COLUMNS : remitoColumns;

  const tableTotals = useMemo(() => {
    if (activeData.length === 0) return {};

    // Keys that make sense to sum up
    const summableKeys = [
      'bultos', 'cajas', 
      'kilosNetos', 'kilosBrutos', 
      'cajasCargadas', 'kilosNetosCargados', 'kilosBrutosCargados',
      'pallets', 'kiloNeto', 'kiloBruto'
    ];

    const result: Record<string, number> = {};
    summableKeys.forEach(key => result[key] = 0);

    activeData.forEach((row: any) => {
      summableKeys.forEach(key => {
        let val = 0;
        // Handle virtual loaded columns for Permisos specially
        if (viewMode === 'permisos' && (key === 'cajasCargadas' || key === 'kilosNetosCargados' || key === 'kilosBrutosCargados')) {
           if (key === 'cajasCargadas') {
             val = remitos.filter(r => r.permisoId === row.id).reduce((acc, r) => acc + (Number(r.cajas) || 0), 0);
           } else if (key === 'kilosNetosCargados') {
             val = remitos.filter(r => r.permisoId === row.id).reduce((acc, r) => acc + (Number(r.kiloNeto) || 0), 0);
           } else {
             val = remitos.filter(r => r.permisoId === row.id).reduce((acc, r) => acc + (Number(r.kiloBruto) || 0), 0);
           }
        } else {
           val = Number(row[key]) || 0;
        }
        result[key] = (result[key] || 0) + val;
      });
    });

    return result;
  }, [activeData, viewMode, remitos]);

  // --- Handlers ---

  const handleFormChange = (key: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      
      // Auto-calculate weights for Remitos based on assigned Permit and Box count
      if (viewMode === 'remitos' || (viewMode === 'dashboard' && editingId)) {
        const isRemito = 'numeroRemito' in next || 'permisoId' in next || (viewMode === 'remitos');
        
        if (isRemito) {
          if (key === 'cajas' || key === 'permisoId') {
            const pId = key === 'permisoId' ? value : next.permisoId;
            const boxes = key === 'cajas' ? parseFloat(value) : parseFloat(next.cajas);
            
            const permit = permisos.find(p => p.id === pId);
            
            if (permit) {
              if (!isNaN(boxes)) {
                const netoUnit = Number(permit.netoUnitario || 0);
                const brutoUnit = Number(permit.brutoUnitario || 0);
                
                next.kiloNeto = Number((boxes * netoUnit).toFixed(2));
                next.kiloBruto = Number((boxes * brutoUnit).toFixed(2));
              }
              
              // Autofill fields from Permit
              if (key === 'permisoId') {
                if (!next.marca) next.marca = permit.marca || '';
                next.exportador = permit.exportador || '';
              }
            }
          }
        }
      }

      // Auto-calculate weights and totals for Permisos
      const isPermiso = 'numeroPermiso' in next && !('permisoId' in next); 
      
      if (viewMode === 'permisos' || (viewMode === 'dashboard' && isPermiso)) {
        const cajas = parseFloat(key === 'cajas' ? value : (next.cajas || '0'));
        
        // Weights Calculation (Unit * Boxes)
        if (key === 'cajas' || key === 'netoUnitario' || key === 'brutoUnitario') {
           const netoUnit = parseFloat(key === 'netoUnitario' ? value : (next.netoUnitario || '0'));
           const brutoUnit = parseFloat(key === 'brutoUnitario' ? value : (next.brutoUnitario || '0'));

           if (!isNaN(cajas)) {
              if (!isNaN(netoUnit)) {
                 next.kilosNetos = Number((cajas * netoUnit).toFixed(2));
              }
              if (!isNaN(brutoUnit)) {
                 next.kilosBrutos = Number((cajas * brutoUnit).toFixed(2));
              }
           }
        }
      }

      return next;
    });
  };

  const handleSave = () => {
    const isRemito = 'numeroRemito' in formData || 'permisoId' in formData;
    const isPermiso = 'numeroPermiso' in formData && !isRemito;

    if (isRemito) {
      if (editingId) {
        setRemitos(prev => prev.map(r => r.id === editingId ? { ...r, ...formData } as Remito : r));
      } else {
        const newRemito = { id: crypto.randomUUID(), ...formData } as Remito;
        setRemitos(prev => [...prev, newRemito]);
      }
    } else if (isPermiso) {
      if (editingId) {
        setPermisos(prev => prev.map(p => p.id === editingId ? { ...p, ...formData } as Permiso : p));
        
        // Recalculate weights for all Remitos linked to this Permit to ensure data integrity
        setRemitos(prev => prev.map(r => {
          if (r.permisoId === editingId) {
             const netoUnit = Number(formData.netoUnitario || 0);
             const brutoUnit = Number(formData.brutoUnitario || 0);
             const cajas = Number(r.cajas || 0);
             return {
               ...r,
               exportador: formData.exportador || r.exportador,
               kiloNeto: Number((cajas * netoUnit).toFixed(2)),
               kiloBruto: Number((cajas * brutoUnit).toFixed(2))
             };
          }
          return r;
        }));
      } else {
        const newPermiso = { id: crypto.randomUUID(), ...formData } as Permiso;
        setPermisos(prev => [...prev, newPermiso]);
      }
    }

    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
  };

  const handleBulkImport = (newRemitos: Remito[]) => {
    setRemitos(prev => [...prev, ...newRemitos]);
    alert(`${newRemitos.length} remitos importados correctamente.`);
  };

  const handleBulkImportPermisos = (newPermisos: Permiso[]) => {
    setPermisos(prev => [...prev, ...newPermisos]);
    alert(`${newPermisos.length} permisos importados correctamente.`);
  };

  const handleDuplicate = (id: string) => {
    if (viewMode === 'permisos') {
      const original = permisos.find(p => p.id === id);
      if (original) {
        const copy = { ...original, id: crypto.randomUUID() };
        setPermisos(prev => [...prev, copy]);
      }
    } else if (viewMode === 'remitos') {
      const original = remitos.find(r => r.id === id);
      if (original) {
        const copy = { ...original, id: crypto.randomUUID() };
        setRemitos(prev => [...prev, copy]);
      }
    }
  };

  const handleDelete = (id: string) => {
    // We check both stores just in case we are in Dashboard where id could be either
    const isPermiso = permisos.some(p => p.id === id);
    const isRemito = remitos.some(r => r.id === id);

    if (isPermiso) {
      const associatedRemitosCount = remitos.filter(r => r.permisoId === id).length;
      
      if (associatedRemitosCount > 0) {
        const confirmMessage = `ADVERTENCIA: Este permiso tiene ${associatedRemitosCount} remitos asociados.\n\nSi elimina el permiso, los remitos quedarán "Sin Asignar" pero NO se eliminarán.\n\n¿Desea continuar y eliminar el permiso?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
        
        // Update associated remitos to have no permission linked
        setRemitos(prev => prev.map(r => r.permisoId === id ? { ...r, permisoId: '' } : r));
      } else {
        if (!confirm("¿Está seguro de eliminar este permiso de embarque?")) return;
      }
      
      setPermisos(prev => prev.filter(p => p.id !== id));
    } else if (isRemito) {
      if (!confirm("¿Está seguro de eliminar este remito?")) return;
      setRemitos(prev => prev.filter(r => r.id !== id));
    }

    // Clear from selection if present
    if (selectedIds.has(id)) {
      const next = new Set(selectedIds);
      next.delete(id);
      setSelectedIds(next);
    }
  };

  // --- Bulk Selection & Deletion ---
  
  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(activeData.map((d: any) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (viewMode === 'permisos') {
      const idsToDelete = Array.from(selectedIds);
      const associatedCount = remitos.filter(r => r.permisoId && idsToDelete.includes(r.permisoId)).length;
      
      let msg = `¿Está seguro de eliminar los ${count} permisos seleccionados?`;
      if (associatedCount > 0) {
        msg += `\n\nADVERTENCIA: Hay ${associatedCount} remitos asociados a estos permisos. Estos remitos quedarán 'Sin Asignar'.`;
      }

      if (confirm(msg)) {
        // Unassign remitos
        setRemitos(prev => prev.map(r => r.permisoId && selectedIds.has(r.permisoId) ? { ...r, permisoId: '' } : r));
        // Delete permits
        setPermisos(prev => prev.filter(p => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
      }
    } else {
      if (confirm(`¿Está seguro de eliminar los ${count} remitos seleccionados?`)) {
        setRemitos(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
      }
    }
  };

  const openEditModal = (row: any) => {
    setFormData(row);
    setEditingId(row.id);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    if (viewMode === 'remitos' && permisos.length === 0) {
      alert("Primero debe cargar Permisos de Embarque para poder asignar remitos.");
      setViewMode('permisos');
      return;
    }
    setFormData(viewMode === 'remitos' ? { fecha: new Date().toISOString().split('T')[0] } : { fechaOficializacion: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // AI Generators
  const handleAiAutofill = async () => {
    setIsGenerating(true);
    try {
      if (viewMode === 'permisos') {
        const generated = await generateMockData(PERMISO_COLUMNS, 4, 'permisos');
        
        // Post-process to add IDs AND Calculate totals (Neto/Bruto Documentado)
        // because AI output doesn't include calculated fields.
        const processed = generated.map((p: any) => {
          const cajas = Number(p.cajas) || 0;
          return {
            ...p, 
            id: crypto.randomUUID(),
            kilosNetos: Number((cajas * (Number(p.netoUnitario) || 0)).toFixed(2)),
            kilosBrutos: Number((cajas * (Number(p.brutoUnitario) || 0)).toFixed(2))
          };
        });
        
        setPermisos(prev => [...prev, ...processed]);
      } else {
         if (permisos.length === 0) {
            alert("Cree permisos primero.");
            setIsGenerating(false);
            return;
         }
         // We pass the actual IDs to the AI so it can link them
         const availablePermitIds = permisos.map(p => p.id);
         const newRemitos = await generateMockData(remitoColumns, 5, 'remitos', availablePermitIds);
         
         // Post-process to fill Exporter from ID and Recalculate weights if necessary
         const withIds = newRemitos.map((r: any) => {
            const permit = permisos.find(p => p.id === r.permisoId);
            return {
               ...r, 
               id: crypto.randomUUID(),
               exportador: permit?.exportador || ''
            };
         });
         setRemitos(prev => [...prev, ...withIds]);
      }
    } catch (e) {
      console.error(e);
      alert("Error generando datos.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Por favor suba un archivo PDF válido.");
      return;
    }

    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        try {
          if (viewMode === 'permisos') {
            const extractedData = await extractPermisoFromPdf(base64String);
            if (extractedData.length > 0) {
              const processedData = extractedData.map((p: any) => {
                 const cajas = Number(p.cajas) || 0;
                 return {
                   ...p,
                   id: crypto.randomUUID(),
                   kilosNetos: Number((cajas * (Number(p.netoUnitario) || 0)).toFixed(2)),
                   kilosBrutos: Number((cajas * (Number(p.brutoUnitario) || 0)).toFixed(2))
                 };
              });
              setPermisos(prev => [...prev, ...processedData]);
              alert(`Se importaron ${processedData.length} items del PDF de Permiso correctamente.`);
            } else {
              alert("No se pudieron extraer datos del PDF.");
            }
          } else if (viewMode === 'remitos') {
            const extractedRemitos = await extractRemitoFromPdf(base64String);
            if (extractedRemitos.length > 0) {
              const processedRemitos = extractedRemitos.map((r: any) => {
                // Try to link with existing permit
                const linkedPermit = permisos.find(p => 
                  p.numeroPermiso.replace(/\s/g, '') === (r.numeroPermiso || '').replace(/\s/g, '') &&
                  (r.itemPermiso ? p.item === r.itemPermiso : true)
                );

                const boxes = Number(r.cajas) || 0;
                let kiloNeto = Number(r.kiloNeto) || 0;
                let kiloBruto = Number(r.kiloBruto) || 0;

                // If not provided in PDF, calculate from linked permit
                if (linkedPermit && kiloNeto === 0) {
                  kiloNeto = Number((boxes * Number(linkedPermit.netoUnitario || 0)).toFixed(2));
                  kiloBruto = Number((boxes * Number(linkedPermit.brutoUnitario || 0)).toFixed(2));
                }

                return {
                  ...r,
                  id: crypto.randomUUID(),
                  permisoId: linkedPermit?.id || '',
                  exportador: linkedPermit?.exportador || r.exportador || '',
                  kiloNeto,
                  kiloBruto
                } as Remito;
              });
              setRemitos(prev => [...prev, ...processedRemitos]);
              alert(`Se importaron ${processedRemitos.length} remitos del PDF correctamente.`);
            } else {
              alert("No se pudieron extraer remitos del PDF.");
            }
          }
        } catch (err) {
          console.error(err);
          alert("Error procesando el PDF con IA. Intente nuevamente.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsUploading(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (permisos.length === 0) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeCitrusData(permisos, remitos);
      setAiAnalysis(analysis);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'dashboard' && !aiAnalysis && permisos.length > 0) {
      handleAnalyze();
    }
  }, [viewMode]);

  // CSV Export
  const exportData = () => {
    const activeCols = viewMode === 'permisos' ? PERMISO_COLUMNS : remitoColumns;
    
    const headers = activeCols.filter(c => !c.readonly).map(c => c.label).join(",");
    const csvRows = activeData.map((row: any) => {
      return activeCols.filter(c => !c.readonly).map(c => {
        let val = row[c.key] === undefined ? "" : row[c.key];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
    });
    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `citrus_${viewMode}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cell Renderer
  const renderCell = (row: any, col: ColumnDef) => {
    // 1. Handle Virtual Columns for Remitos (Lookups)
    if (viewMode === 'remitos') {
      const linkedPermiso = permisos.find(p => p.id === row.permisoId);
      
      if (col.key === 'view_producto') return linkedPermiso?.producto || '-';
      if (col.key === 'view_variedad') return linkedPermiso?.variedad || '-';
      if (col.key === 'view_item') return linkedPermiso?.item || '-';
      if (col.key === 'view_subItem') return linkedPermiso?.subItem || '-';
      
      if (col.key === 'permisoId') {
        return linkedPermiso 
          ? `${linkedPermiso.numeroPermiso}`
          : <span className="text-red-400 italic">Sin asignar</span>;
      }
    }

    // 2. Handle Virtual Columns for Permisos (Aggregations)
    if (viewMode === 'permisos') {
        if (col.key === 'cajasCargadas') {
            const sum = remitos
                .filter(r => r.permisoId === row.id)
                .reduce((acc, r) => acc + (Number(r.cajas) || 0), 0);
            return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
        }
        if (col.key === 'kilosNetosCargados') {
            const sum = remitos
                .filter(r => r.permisoId === row.id)
                .reduce((acc, r) => acc + (Number(r.kiloNeto) || 0), 0);
            return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
        }
        if (col.key === 'kilosBrutosCargados') {
            const sum = remitos
                .filter(r => r.permisoId === row.id)
                .reduce((acc, r) => acc + (Number(r.kiloBruto) || 0), 0);
             return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
        }
        // Styling for Documented columns
        if (col.key === 'kilosNetos' || col.key === 'kilosBrutos') {
           return <span className="text-blue-700 font-medium">{Number(row[col.key]).toLocaleString('es-AR')}</span>
        }
    }
    
    // 3. Regular Formatting
    let val = row[col.key];
    if (col.type === FieldType.NUMBER && typeof val === 'number') {
        return val.toLocaleString('es-AR'); 
    }
    if (col.type === FieldType.DATE && val) {
       return val; 
    }
    return val;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="application/pdf"
      />

      {/* Navbar */}
      <header className="bg-green-700 border-b border-green-800 shadow-md sticky top-0 z-30 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
              <Citrus size={24} className="text-yellow-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">LEO ROM</h1>
              <p className="text-xs text-green-100 opacity-90">Gestión de Embarques y Remitos</p>
            </div>
          </div>
          
          <div className="flex bg-green-800/50 rounded-lg p-1">
            <button onClick={() => setViewMode('permisos')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'permisos' ? 'bg-white text-green-800 shadow-sm' : 'text-green-100 hover:bg-green-700/50'}`}>
              <div className="flex items-center gap-2"><Container size={16} /> Permisos</div>
            </button>
            <button onClick={() => setViewMode('remitos')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'remitos' ? 'bg-white text-green-800 shadow-sm' : 'text-green-100 hover:bg-green-700/50'}`}>
              <div className="flex items-center gap-2"><FileText size={16} /> Remitos</div>
            </button>
            <button onClick={() => setViewMode('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-white text-green-800 shadow-sm' : 'text-green-100 hover:bg-green-700/50'}`}>
              <div className="flex items-center gap-2"><LayoutGrid size={16} /> Tablero</div>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {viewMode === 'permisos' && 'Permisos de Embarque'}
              {viewMode === 'remitos' && 'Ingreso de Remitos'}
              {viewMode === 'dashboard' && 'Tablero de Control'}
            </h2>
            <p className="text-slate-500 text-sm">
              {viewMode === 'permisos' && 'Administración de cupos AFIP por Item/SubItem.'}
              {viewMode === 'remitos' && 'Asignación a permisos y detalle de pallets/cajas.'}
              {viewMode === 'dashboard' && 'Visualización de métricas y cumplimiento.'}
            </p>
          </div>

          {viewMode !== 'dashboard' && (
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <Button 
                  variant="danger" 
                  onClick={handleBulkDelete} 
                  icon={<Trash2 size={16} />}
                >
                  Eliminar ({selectedIds.size})
                </Button>
              )}
              
              <Button variant="secondary" onClick={exportData} icon={<Download size={16} />} disabled={activeData.length === 0}>
                Exportar
              </Button>
              
              {viewMode === 'permisos' && (
                <Button 
                  variant="secondary" 
                  onClick={() => setIsBulkPermisosModalOpen(true)}
                  icon={<ClipboardList size={16} />}
                >
                  Pegar desde Excel
                </Button>
              )}

              {/* Remitos Bulk Import Button */}
              {viewMode === 'remitos' && (
                <Button 
                  variant="secondary"
                  onClick={() => setIsBulkModalOpen(true)}
                  icon={<ClipboardList size={16} />}
                >
                  Pegar desde Excel
                </Button>
              )}

              {/* Shared PDF Upload for both Permisos and Remitos */}
              {(viewMode === 'permisos' || viewMode === 'remitos') && (
                <Button 
                  variant="secondary" 
                  onClick={triggerFileUpload} 
                  isLoading={isUploading} 
                  icon={<Upload size={16} />}
                >
                  Subir PDF
                </Button>
              )}

              <Button 
                variant="secondary" 
                onClick={handleAiAutofill} 
                isLoading={isGenerating} 
                icon={<Bot size={16} />}
              >
                Generar con IA
              </Button>
              
              <Button 
                variant="primary" 
                onClick={openAddModal} 
                icon={<Plus size={16} />}
              >
                {viewMode === 'permisos' ? 'Nuevo Permiso' : 'Nuevo Remito'}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {viewMode === 'dashboard' ? (
          <Dashboard 
            permisos={permisos} 
            remitos={remitos} 
            aiAnalysis={aiAnalysis} 
            onEditRemito={(remito) => openEditModal(remito)}
            onEditPermiso={(permiso) => openEditModal(permiso)}
            onDeleteRemito={(id) => handleDelete(id)}
            onDeletePermiso={(id) => handleDelete(id)}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={activeData.length > 0 && selectedIds.size === activeData.length}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    {activeColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {activeData.length === 0 ? (
                    <tr>
                      <td colSpan={activeColumns.length + 2} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <Container className="w-12 h-12 mb-2 opacity-20" />
                          <p>No hay datos cargados.</p>
                          <p className="text-xs">Use "Generar con IA", "Subir PDF" o "Nuevo" para comenzar.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeData.map((row: any) => (
                      <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(row.id) ? 'bg-green-50' : ''}`}>
                         <td className="px-3 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(row.id)}
                            onChange={() => handleSelectRow(row.id)}
                            className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        {activeColumns.map((col) => (
                          <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {renderCell(row, col)}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                             <Button variant="ghost" size="sm" onClick={() => handleDuplicate(row.id)} title="Duplicar">
                                <Copy size={16} className="text-amber-500" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
                                <Edit2 size={16} className="text-blue-500" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
                                <Trash2 size={16} className="text-red-500" />
                             </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Footer Totals */}
                {activeData.length > 0 && (
                   <tfoot className="bg-slate-100 font-semibold text-slate-700 border-t border-slate-300">
                      <tr>
                        <td className="px-3 py-3"></td>
                        {activeColumns.map(col => {
                           if (tableTotals[col.key] !== undefined) {
                              return (
                                 <td key={col.key} className="px-6 py-3 text-sm whitespace-nowrap">
                                    {tableTotals[col.key].toLocaleString('es-AR')}
                                 </td>
                              );
                           }
                           return <td key={col.key} className="px-6 py-3"></td>
                        })}
                        <td className="px-6 py-3"></td>
                      </tr>
                   </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId 
          ? ('Editar Registro')
          : (viewMode === 'permisos' ? 'Nuevo Permiso' : 'Nuevo Remito')
        }
      >
        <div className="space-y-4">
          {/* Dynamically decide which columns to show in form based on object type if editingId exists, or viewMode if new */}
          {(editingId 
              ? ('numeroPermiso' in formData ? PERMISO_COLUMNS : remitoColumns) 
              : (viewMode === 'permisos' ? PERMISO_COLUMNS : remitoColumns)
           )
           .filter(c => !c.readonly).map((col) => (
             <div key={col.key}>
                {col.type === FieldType.SELECT ? (
                   <Select
                      label={col.label}
                      options={col.options || []}
                      value={formData[col.key] || ''}
                      onChange={(e) => handleFormChange(col.key, e.target.value)}
                      required={!col.optional}
                   />
                ) : (
                   <Input
                      label={col.label}
                      type={col.type}
                      value={formData[col.key] || ''}
                      onChange={(e) => handleFormChange(col.key, e.target.value)}
                      placeholder={col.placeholder}
                      disabled={col.calculated}
                      required={!col.optional}
                   />
                )}
             </div>
          ))}
          
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} icon={<Save size={16} />}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Remitos Modal */}
      <BulkPasteModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        onImport={handleBulkImport}
        permisos={permisos}
      />
      
      {/* Bulk Import Permisos Modal */}
      <BulkPastePermisosModal 
        isOpen={isBulkPermisosModalOpen}
        onClose={() => setIsBulkPermisosModalOpen(false)}
        onImport={handleBulkImportPermisos}
      />
    </div>
  );
};

export default App;
