
import React, { useState, useEffect } from 'react';
import { X, Clipboard, AlertCircle, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import { Permiso, Remito } from '../types';
import { Button } from './Button';

interface BulkPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (remitos: Remito[]) => void;
  permisos: Permiso[];
}

export const BulkPasteModal: React.FC<BulkPasteModalProps> = ({ isOpen, onClose, onImport, permisos }) => {
  const [text, setText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [step, setStep] = useState<'paste' | 'preview'>('paste');

  useEffect(() => {
    if (isOpen) {
      setText('');
      setParsedData([]);
      setStep('paste');
    }
  }, [isOpen]);

  const handleParse = () => {
    if (!text.trim()) return;

    // Helper to parse localized numbers (e.g. "1.200,50" -> 1200.5)
    const parseNumber = (val: string) => {
      if (!val) return 0;
      let clean = val.trim();
      // Heuristic for Spanish/Argentine Excel format
      if (clean.includes(',')) {
        // Remove dots (thousands separators)
        clean = clean.replace(/\./g, '');
        // Replace comma with dot (decimal separator)
        clean = clean.replace(',', '.');
      }
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const rows = text.trim().split(/\r\n|\n|\r/);
    const result = rows.map((row, index) => {
      // Skip empty rows
      if (!row.trim()) return null;

      const cols = row.split('\t').map(c => c.trim());
      
      // NEW MAPPING based on user request (23 columns approx)
      // 0: FECHA
      // ...
      // 2: Nº REMITO
      // ...
      // 13: MARCA
      // 14: CONTRAMARCA
      // 15: PALLETS
      // 17: CAJAS
      // 18: PERMISO
      // 19: ITEM
      // 20: SUB
      
      const fecha = cols[0] || new Date().toISOString().split('T')[0];
      const numeroRemito = cols[2] || '';
      
      const marca = cols[13] || '';
      const contramarca = cols[14] || '';
      const pallets = parseNumber(cols[15]);
      const cajas = parseNumber(cols[17]);
      
      const numeroPermiso = cols[18] || '';
      const item = cols[19] || '';
      const subItem = cols[20] || '';

      // Attempt to find linked permit
      const linkedPermiso = permisos.find(p => 
        p.numeroPermiso.replace(/\s/g, '') === numeroPermiso.replace(/\s/g, '') && 
        p.item === item && 
        (subItem === '-' || subItem === '' ? true : p.subItem === subItem)
      );

      let status: 'ok' | 'error' | 'warning' = 'ok';
      let message = '';
      let calculatedData = {};

      if (!numeroRemito) {
        status = 'error';
        message = 'Falta N° Remito';
      } else if (!linkedPermiso) {
        // Treat missing permit as Warning, not Error
        status = 'warning';
        message = `Permiso no encontrado (${numeroPermiso} Item ${item}). Se importará sin asignar.`;
        
        // No calculated data possible if permit is missing
        calculatedData = {
          permisoId: '',
          exportador: '',
          kiloNeto: 0,
          kiloBruto: 0,
        };
      } else {
        // Calculate weights
        const netoUnit = Number(linkedPermiso.netoUnitario || 0);
        const brutoUnit = Number(linkedPermiso.brutoUnitario || 0);
        
        calculatedData = {
          permisoId: linkedPermiso.id,
          exportador: linkedPermiso.exportador, // Inherit Exporter
          kiloNeto: Number((cajas * netoUnit).toFixed(2)),
          kiloBruto: Number((cajas * brutoUnit).toFixed(2)),
        };
      }

      return {
        id: crypto.randomUUID(),
        numeroRemito,
        fecha,
        numeroPermiso, // For display only
        item, // For display
        subItem, // For display
        marca,
        contramarca,
        pallets,
        cajas,
        status,
        message,
        ...calculatedData
      };
    }).filter(Boolean); // Remove nulls from empty rows

    setParsedData(result);
    setStep('preview');
  };

  const handleSave = () => {
    // Include both 'ok' and 'warning' statuses
    const validRemitos = parsedData
      .filter(r => r.status === 'ok' || r.status === 'warning')
      .map(r => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, message, numeroPermiso, item, subItem, ...remitoData } = r;
        return remitoData as Remito;
      });

    onImport(validRemitos);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Clipboard className="text-green-600" />
            Importación Masiva de Remitos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-hidden flex-1 flex flex-col">
          
          {step === 'paste' ? (
            <div className="flex-1 flex-col gap-4 flex h-full">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-2">Instrucciones:</p>
                <p className="mb-2">Copie las filas directamente de su Excel. El sistema espera el siguiente orden de columnas (aunque algunas se ignoran):</p>
                
                <div className="mt-3 bg-white p-3 rounded border border-blue-200 font-mono text-xs overflow-x-auto whitespace-nowrap leading-relaxed">
                  <span className="font-bold text-blue-700">1. FECHA</span> | 
                  <span className="text-slate-400"> 2. EXPORTADOR</span> | 
                  <span className="font-bold text-blue-700"> 3. Nº REMITO</span> | 
                  <span className="text-slate-400"> 4. CHOFER</span> | 
                  <span className="text-slate-400"> 5. DNI</span> | 
                  <span className="text-slate-400"> 6. CHASIS</span> | 
                  <span className="text-slate-400"> 7. SEMI</span> | 
                  <span className="text-slate-400"> 8. MERCADERIA</span> | 
                  <span className="text-slate-400"> 9. ESTADO</span> | 
                  <span className="text-slate-400"> 10. CANAL</span> | 
                  <span className="text-slate-400"> 11. CLIENTE</span> | 
                  <span className="text-slate-400"> 12. DESTINO</span> | 
                  <span className="text-slate-400"> 13. VARIEDAD</span> | 
                  <span className="font-bold text-blue-700"> 14. MARCA</span> | 
                  <span className="font-bold text-blue-700"> 15. CONTRAMARCA</span> | 
                  <span className="font-bold text-blue-700"> 16. PALLETS</span> | 
                  <span className="text-slate-400"> 17. CXP</span> | 
                  <span className="font-bold text-blue-700"> 18. CAJAS</span> | 
                  <span className="font-bold text-blue-700"> 19. PERMISO</span> | 
                  <span className="font-bold text-blue-700"> 20. ITEM</span> | 
                  <span className="font-bold text-blue-700"> 21. SUB</span> | 
                  <span className="text-slate-400"> ... resto</span>
                </div>
              </div>
              <textarea
                className="flex-1 w-full p-4 border border-slate-300 rounded-md font-mono text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none leading-loose whitespace-pre"
                placeholder="Pegue aquí las filas de Excel..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-md">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Remito</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Permiso Detectado</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Marca/Contra</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Pallets</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cajas</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Kg Bruto (Calc)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {parsedData.map((row, i) => {
                    let bgClass = 'hover:bg-slate-50';
                    if (row.status === 'error') bgClass = 'bg-red-50';
                    if (row.status === 'warning') bgClass = 'bg-yellow-50';

                    return (
                      <tr key={i} className={bgClass}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {row.status === 'ok' ? (
                            <CheckCircle2 size={16} className="text-green-500" />
                          ) : row.status === 'warning' ? (
                            <div className="flex items-center gap-1 text-yellow-600" title={row.message}>
                                <AlertTriangle size={16} />
                                <span className="text-xs font-medium">Sin asignar</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600" title={row.message}>
                              <AlertCircle size={16} />
                              <span className="text-xs font-medium">Error</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-900 font-mono">
                           <div>{row.numeroRemito}</div>
                           <div className="text-xs text-slate-500">{row.fecha}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                            {row.numeroPermiso ? (
                                <div>
                                    <span className="font-mono">{row.numeroPermiso}</span>
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-xs text-slate-500">
                                        It: {row.item}/{row.subItem}
                                    </span>
                                </div>
                            ) : '-'}
                            {row.status === 'warning' && <span className="text-xs text-yellow-600 block">(No coincide con base de datos)</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                            {row.marca} {row.contramarca ? `/ ${row.contramarca}` : ''}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{row.pallets.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{row.cajas.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-sm text-right text-slate-500">
                           {row.kiloBruto ? row.kiloBruto.toLocaleString('es-AR') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          {step === 'preview' && (
             <div className="text-sm text-slate-500">
                Se importarán <b>{parsedData.filter(r => r.status === 'ok' || r.status === 'warning').length}</b> registros.
             </div>
          )}
          <div className="flex gap-2 ml-auto">
             {step === 'preview' && (
                <Button variant="secondary" onClick={() => setStep('paste')}>
                   Atrás
                </Button>
             )}
             
             {step === 'paste' ? (
                <Button onClick={handleParse} disabled={!text.trim()} icon={<ArrowRight size={16} />}>
                   Analizar Datos
                </Button>
             ) : (
                <Button 
                    onClick={handleSave} 
                    disabled={parsedData.filter(r => r.status === 'ok' || r.status === 'warning').length === 0} 
                    icon={<CheckCircle2 size={16} />}
                >
                   Confirmar Importación
                </Button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
