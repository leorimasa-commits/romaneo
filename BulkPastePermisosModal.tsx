
import React, { useState, useEffect } from 'react';
import { X, Clipboard, AlertCircle, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import { Permiso } from '../types';
import { Button } from './Button';

interface BulkPastePermisosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (permisos: Permiso[]) => void;
}

export const BulkPastePermisosModal: React.FC<BulkPastePermisosModalProps> = ({ isOpen, onClose, onImport }) => {
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
      
      // NEW Expected columns Order (17 cols): 
      // 0: DESTINO
      // ...
      // 11: PALETIZADO
      // 12: N.U
      // 13: B.U
      // 14: CAJAS

      const paisDestino = cols[0] || '';
      const exportador = cols[1] || '';
      const numeroPermiso = cols[2] || '';
      const item = cols[3] || '';
      const subItem = cols[4] || '';
      const producto = cols[5] || '';
      const variedad = cols[6] || '';
      const vapor = cols[7] || '';
      const marca = cols[8] || '';
      const contramarca = cols[9] || '';
      
      const fechaOficializacion = cols[10] || new Date().toISOString().split('T')[0];
      
      const bultos = parseNumber(cols[11]);
      
      const netoUnitario = parseNumber(cols[12]);
      const brutoUnitario = parseNumber(cols[13]);
      
      const cajas = parseNumber(cols[14]);
      
      // Cols 15 (Neto) and 16 (Bruto) are ignored because we calculate them to ensure consistency

      let status: 'ok' | 'error' | 'warning' = 'ok';
      let message = '';

      // Relaxed validation: Allow missing fields but warn user
      if (!numeroPermiso) {
        status = 'warning';
        message = 'Falta N° Permiso';
      } else if (!exportador) {
        status = 'warning';
        message = 'Falta Exportador';
      }

      // Calculate totals
      const kilosNetos = Number((cajas * netoUnitario).toFixed(2));
      const kilosBrutos = Number((cajas * brutoUnitario).toFixed(2));

      return {
        id: crypto.randomUUID(),
        exportador,
        numeroPermiso,
        fechaOficializacion,
        paisDestino,
        vapor,
        item,
        subItem,
        producto,
        variedad,
        marca,
        contramarca,
        bultos,
        cajas,
        netoUnitario,
        brutoUnitario,
        kilosNetos,
        kilosBrutos,
        cajasCargadas: 0,
        kilosNetosCargados: 0,
        kilosBrutosCargados: 0,
        status,
        message
      };
    }).filter(Boolean);

    setParsedData(result);
    setStep('preview');
  };

  const handleSave = () => {
    // Include both OK and Warning rows
    const validPermisos = parsedData
      .filter(r => r.status === 'ok' || r.status === 'warning')
      .map(r => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, message, ...permisoData } = r;
        return permisoData as Permiso;
      });

    onImport(validPermisos);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Clipboard className="text-blue-600" />
            Importación Masiva de Permisos de Embarque
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-hidden flex-1 flex flex-col">
          
          {step === 'paste' ? (
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-2">Instrucciones:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Copie sus datos desde Excel (sin encabezados).</li>
                  <li>Asegúrese de que las columnas estén en este orden exacto (17 columnas):</li>
                </ol>
                <div className="mt-3 bg-white p-2 rounded border border-blue-200 font-mono text-xs overflow-x-auto whitespace-nowrap">
                  <span className="font-bold text-blue-700">DESTINO</span> | 
                  <span className="font-bold text-blue-700"> EXPORTADOR</span> | 
                  <span className="font-bold text-blue-700"> PERMISO</span> | 
                  <span className="text-slate-500"> ITEM</span> | 
                  <span className="text-slate-500"> SUB</span> | 
                  <span className="text-slate-500"> MERCADERIA</span> | 
                  <span className="text-slate-500"> VARIEDAD</span> | 
                  <span className="text-slate-500"> CONT/BODEGA</span> | 
                  <span className="text-slate-500"> MARCA</span> | 
                  <span className="text-slate-500"> CM/CLIENTE</span> | 
                  <span className="text-slate-500"> OFICIALIZADO</span> | 
                  <span className="text-slate-500"> PALETIZADO</span> | 
                  <span className="text-slate-500"> N.U</span> | 
                  <span className="text-slate-500"> B.U</span> | 
                  <span className="font-bold text-blue-700"> CAJAS</span> | 
                  <span className="text-slate-400"> NETO</span> | 
                  <span className="text-slate-400"> BRUTO</span>
                </div>
              </div>
              <textarea
                className="flex-1 w-full p-4 border border-slate-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-loose whitespace-pre"
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
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Destino</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Exportador</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Permiso</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Prod/Var</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cajas</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Neto Total</th>
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
                                <span className="text-xs font-medium">Incompleto</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600" title={row.message}>
                              <AlertCircle size={16} />
                              <span className="text-xs font-medium">Error</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">
                            {row.paisDestino || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-900">
                            {row.exportador || <span className="text-slate-400 italic">Falta</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600 font-mono">
                            {row.numeroPermiso ? `${row.numeroPermiso} (${row.item}/${row.subItem})` : <span className="text-slate-400 italic">Falta</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">{row.producto} {row.variedad}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{row.cajas.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-sm text-right text-blue-600 font-medium">
                           {row.kilosNetos ? row.kilosNetos.toLocaleString('es-AR') : '-'}
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
