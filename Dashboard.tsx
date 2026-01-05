
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Permiso, Remito, ColumnDef, FieldType } from '../types';
import { Sparkles, Scale, Package, Truck, Boxes, Container, BarChart3, ClipboardList, ArrowUpRight, Edit2, Trash2, Filter, Settings2, PieChart as PieIcon } from 'lucide-react';
import { Button } from './Button';
import { Select } from './Input';
import { PERMISO_COLUMNS } from '../App';

interface DashboardProps {
  permisos: Permiso[];
  remitos: Remito[];
  aiAnalysis: string;
  onEditRemito: (remito: Remito) => void;
  onEditPermiso: (permiso: Permiso) => void;
  onDeleteRemito: (id: string) => void;
  onDeletePermiso: (id: string) => void;
}

const COLORS = ['#65a30d', '#ea580c', '#eab308', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16'];

export const Dashboard: React.FC<DashboardProps> = ({ 
  permisos, 
  remitos, 
  aiAnalysis, 
  onEditRemito, 
  onEditPermiso,
  onDeleteRemito,
  onDeletePermiso
}) => {
  
  // --- STATE FOR FILTERS & DYNAMIC STATS ---
  const [filterExporter, setFilterExporter] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  const [dynamicGroup, setDynamicGroup] = useState('paisDestino');
  const [dynamicMetric, setDynamicMetric] = useState('kilosBrutos');

  // --- HELPER: EXTRACT UNIQUE OPTIONS ---
  const uniqueExporters = useMemo(() => Array.from(new Set(permisos.map(p => p.exportador).filter(Boolean))).sort(), [permisos]);
  const uniqueProducts = useMemo(() => Array.from(new Set(permisos.map(p => p.producto).filter(Boolean))).sort(), [permisos]);

  // --- FILTERING LOGIC ---
  const filteredPermisos = useMemo(() => {
    return permisos.filter(p => {
      if (filterExporter && p.exportador !== filterExporter) return false;
      if (filterProduct && p.producto !== filterProduct) return false;
      return true;
    });
  }, [permisos, filterExporter, filterProduct]);

  const filteredRemitos = useMemo(() => {
    return remitos.filter(r => {
      const parent = permisos.find(p => p.id === r.permisoId);
      const exporter = parent?.exportador || r.exportador;
      const product = parent?.producto || ''; 
      if (filterExporter && exporter !== filterExporter) return false;
      if (filterProduct && product !== filterProduct) return false;
      return true;
    });
  }, [remitos, permisos, filterExporter, filterProduct]);


  // --- REMITO COLUMNS DEFINITION ---
  const dashboardRemitoColumns: ColumnDef[] = useMemo(() => [
      { key: 'exportador', label: 'Exportador', type: FieldType.STRING },
      { key: 'numeroRemito', label: 'N° Remito', type: FieldType.STRING },
      { key: 'fecha', label: 'Fecha', type: FieldType.DATE },
      { key: 'view_producto', label: 'Producto', type: FieldType.STRING }, // Virtual
      { key: 'view_variedad', label: 'Variedad', type: FieldType.STRING }, // Virtual
      { key: 'permisoId', label: 'Permiso', type: FieldType.STRING }, // Special render
      { key: 'marca', label: 'Marca', type: FieldType.STRING },
      { key: 'contramarca', label: 'Contramarca', type: FieldType.STRING },
      { key: 'pallets', label: 'Pallets', type: FieldType.NUMBER },
      { key: 'cajas', label: 'Cajas', type: FieldType.NUMBER },
      { key: 'kiloNeto', label: 'Kilo Neto', type: FieldType.NUMBER },
      { key: 'kiloBruto', label: 'Kilo Bruto', type: FieldType.NUMBER },
  ], []);


  // --- 1. KPI Totals ---
  const totalKilosPermitidos = filteredPermisos.reduce((acc, p) => acc + Number(p.kilosBrutos), 0);
  const totalKilosRemitidos = filteredRemitos.reduce((acc, r) => acc + Number(r.kiloBruto), 0);
  const totalPallets = filteredRemitos.reduce((acc, r) => acc + Number(r.pallets), 0);
  const totalCajasRemitidas = filteredRemitos.reduce((acc, r) => acc + Number(r.cajas), 0);


  // --- 2. STATISTICS SECTION DATA ---
  const statisticsData = useMemo(() => {
    const byExporter: Record<string, { pallets: number, net: number, gross: number }> = {};
    const byProduct: Record<string, { pallets: number, net: number, gross: number }> = {};
    const byPermit: Record<string, { 
        pallets: number, 
        cajas: number,
        net: number, 
        gross: number, 
        permitNet: number,
        permitGross: number, 
        exportador: string 
    }> = {};

    filteredPermisos.forEach(p => {
        const key = p.numeroPermiso;
        if (!byPermit[key]) {
            byPermit[key] = { 
                pallets: 0, cajas: 0, net: 0, gross: 0, 
                permitNet: 0, permitGross: 0, 
                exportador: p.exportador 
            };
        }
        byPermit[key].permitNet += Number(p.kilosNetos || 0);
        byPermit[key].permitGross += Number(p.kilosBrutos || 0);
    });

    filteredRemitos.forEach(r => {
        const p = permisos.find(perm => perm.id === r.permisoId);
        
        const exporterName = p?.exportador || r.exportador || 'Desconocido';
        if (!byExporter[exporterName]) byExporter[exporterName] = { pallets: 0, net: 0, gross: 0 };
        byExporter[exporterName].pallets += Number(r.pallets || 0);
        byExporter[exporterName].net += Number(r.kiloNeto || 0);
        byExporter[exporterName].gross += Number(r.kiloBruto || 0);

        const productName = p?.producto || 'Sin Producto';
        if (!byProduct[productName]) byProduct[productName] = { pallets: 0, net: 0, gross: 0 };
        byProduct[productName].pallets += Number(r.pallets || 0);
        byProduct[productName].net += Number(r.kiloNeto || 0);
        byProduct[productName].gross += Number(r.kiloBruto || 0);

        const permitNum = p?.numeroPermiso || 'Sin Asignar';
        if (permitNum !== 'Sin Asignar' && byPermit[permitNum]) {
             byPermit[permitNum].pallets += Number(r.pallets || 0);
             byPermit[permitNum].cajas += Number(r.cajas || 0);
             byPermit[permitNum].net += Number(r.kiloNeto || 0);
             byPermit[permitNum].gross += Number(r.kiloBruto || 0);
        }
    });

    return {
        exporterChart: Object.entries(byExporter).map(([name, data]) => ({ name, ...data })),
        productChart: Object.entries(byProduct).map(([name, data]) => ({ name, value: data.gross, ...data })),
        permitTable: Object.entries(byPermit).map(([name, data]) => ({ name, ...data }))
    };
  }, [filteredPermisos, filteredRemitos, permisos]);


  // --- 3. DYNAMIC STATISTICS CALCULATION ---
  const dynamicStatsData = useMemo(() => {
    const map: Record<string, number> = {};

    filteredRemitos.forEach(r => {
      const p = permisos.find(perm => perm.id === r.permisoId);
      
      let key = 'Sin Asignar';
      if (dynamicGroup === 'exportador') key = p?.exportador || r.exportador || 'Sin Asignar';
      else if (dynamicGroup === 'producto') key = p?.producto || 'Sin Producto';
      else if (dynamicGroup === 'variedad') key = p?.variedad || 'Sin Variedad';
      else if (dynamicGroup === 'paisDestino') key = p?.paisDestino || 'Sin Destino';
      else if (dynamicGroup === 'vapor') key = p?.vapor || 'Sin Vapor';
      else if (dynamicGroup === 'marca') key = r.marca || p?.marca || 'Sin Marca';

      let value = 0;
      if (dynamicMetric === 'cajas') value = Number(r.cajas || 0);
      else if (dynamicMetric === 'pallets') value = Number(r.pallets || 0);
      else if (dynamicMetric === 'kilosNetos') value = Number(r.kiloNeto || 0);
      else if (dynamicMetric === 'kilosBrutos') value = Number(r.kiloBruto || 0);

      map[key] = (map[key] || 0) + value;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  }, [filteredRemitos, permisos, dynamicGroup, dynamicMetric]);


  // --- RENDER HELPERS ---
  const renderPermisoCell = (permiso: any, col: ColumnDef) => {
      if (col.key === 'cajasCargadas') {
          const sum = remitos.filter(r => r.permisoId === permiso.id).reduce((acc, r) => acc + (Number(r.cajas) || 0), 0);
          return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
      }
      if (col.key === 'kilosNetosCargados') {
          const sum = remitos.filter(r => r.permisoId === permiso.id).reduce((acc, r) => acc + (Number(r.kiloNeto) || 0), 0);
          return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
      }
      if (col.key === 'kilosBrutosCargados') {
          const sum = remitos.filter(r => r.permisoId === permiso.id).reduce((acc, r) => acc + (Number(r.kiloBruto) || 0), 0);
            return <span className="text-green-600 font-semibold">{sum.toLocaleString('es-AR')}</span>;
      }
      if (col.key === 'kilosNetos' || col.key === 'kilosBrutos') {
          return <span className="text-blue-700 font-medium">{Number(permiso[col.key]).toLocaleString('es-AR')}</span>
      }

      let val = permiso[col.key];
      if (col.type === FieldType.NUMBER && typeof val === 'number') return val.toLocaleString('es-AR');
      return val;
  };

  const renderRemitoCell = (remito: any, col: ColumnDef) => {
      const linkedPermiso = permisos.find(p => p.id === remito.permisoId);

      if (col.key === 'view_producto') return linkedPermiso?.producto || '-';
      if (col.key === 'view_variedad') return linkedPermiso?.variedad || '-';
      
      if (col.key === 'permisoId') {
        return linkedPermiso 
          ? `${linkedPermiso.numeroPermiso} (${linkedPermiso.item}/${linkedPermiso.subItem})`
          : <span className="text-red-400 italic">Sin asignar</span>;
      }

      let val = remito[col.key];
      if (col.type === FieldType.NUMBER && typeof val === 'number') return val.toLocaleString('es-AR');
      return val;
  };


  if (permisos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Sparkles className="w-10 h-10 mb-2 opacity-50" />
        <p>Cargue Permisos de Embarque para ver visualizaciones.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-2">
      
      {/* --- FILTER BAR --- */}
      <div className="col-span-1 lg:col-span-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold mr-2 mb-2">
          <Filter size={20} className="text-blue-600" />
          <span>Filtros Globales:</span>
        </div>
        <div className="w-full sm:w-64">
          <Select 
            label="Filtrar por Exportador" 
            options={uniqueExporters} 
            value={filterExporter}
            onChange={(e) => setFilterExporter(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select 
            label="Filtrar por Producto" 
            options={uniqueProducts} 
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
          />
        </div>
        {(filterExporter || filterProduct) && (
          <Button 
             variant="ghost" 
             onClick={() => { setFilterExporter(''); setFilterProduct(''); }}
             className="mb-0.5 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            Limpiar Filtros
          </Button>
        )}
      </div>

      {/* KPIs Row */}
      <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-700 rounded-full"><Scale size={24} /></div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Kg Brutos (Filtrado)</p>
                <p className="text-xl font-bold text-slate-800">{totalKilosRemitidos.toLocaleString()}</p>
                <p className="text-xs text-slate-400">de {totalKilosPermitidos.toLocaleString()} permitidos</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-700 rounded-full"><Boxes size={24} /></div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Pallets (Filtrado)</p>
                <p className="text-xl font-bold text-slate-800">{totalPallets.toLocaleString()}</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-full"><Package size={24} /></div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Cajas (Filtrado)</p>
                <p className="text-xl font-bold text-slate-800">{totalCajasRemitidas.toLocaleString()}</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-full"><Truck size={24} /></div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Remitos (Filtrado)</p>
                <p className="text-xl font-bold text-slate-800">{filteredRemitos.length}</p>
            </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="col-span-1 lg:col-span-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-lg p-6">
        <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
          <Sparkles size={18} />
          <h3>Análisis Inteligente (General)</h3>
        </div>
        <p className="text-slate-700 leading-relaxed text-sm">
          {aiAnalysis || "Generando análisis de exportación..."}
        </p>
      </div>

      {/* --- STATISTICS SECTION --- */}
      <div className="col-span-1 lg:col-span-4 mt-4 mb-2">
         <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
             <BarChart3 className="text-blue-600" />
             Estadísticas de Carga (Datos Reales Filtrados)
         </h2>
      </div>

      {/* Stats 1: Real Loaded Kilos per Exporter */}
      <div className="col-span-1 lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">
          Carga por Exportador (Neto vs Bruto)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statisticsData.exporterChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => value.toLocaleString() + ' kg'}
              />
              <Legend />
              <Bar dataKey="net" name="Kilos Netos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="gross" name="Kilos Brutos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats 2: Product Distribution Pie */}
      <div className="col-span-1 lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">
          Distribución por Producto (Kg Brutos)
        </h3>
        <div className="h-72 flex flex-col md:flex-row items-center">
            <div className="flex-1 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statisticsData.productChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statisticsData.productChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => val.toLocaleString() + ' kg'} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 text-sm p-4 w-full">
                {statisticsData.productChart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-1">
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                             <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="text-slate-500">{item.gross.toLocaleString()} kg</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* --- NEW SECTION: DYNAMIC STATISTICS --- */}
      <div className="col-span-1 lg:col-span-4 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm p-4 mt-2 mb-2">
        <div className="flex flex-wrap items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
             <Settings2 className="text-indigo-600" />
             Estadísticas Dinámicas
          </h2>
          <div className="flex gap-4 w-full md:w-auto mt-2 md:mt-0">
             <div className="w-full md:w-48">
               <Select 
                 label="Agrupar Por:" 
                 options={[
                   { label: 'País Destino', value: 'paisDestino' },
                   { label: 'Vapor / Transporte', value: 'vapor' },
                   { label: 'Marca', value: 'marca' },
                   { label: 'Exportador', value: 'exportador' },
                   { label: 'Producto', value: 'producto' },
                   { label: 'Variedad', value: 'variedad' }
                 ]} 
                 value={dynamicGroup} 
                 onChange={(e) => setDynamicGroup(e.target.value)} 
                 className="bg-white"
               />
             </div>
             <div className="w-full md:w-48">
               <Select 
                 label="Calcular:" 
                 options={[
                   { label: 'Kilos Brutos (kg)', value: 'kilosBrutos' },
                   { label: 'Kilos Netos (kg)', value: 'kilosNetos' },
                   { label: 'Cajas (Unidades)', value: 'cajas' },
                   { label: 'Pallets (Bultos)', value: 'pallets' },
                 ]} 
                 value={dynamicMetric} 
                 onChange={(e) => setDynamicMetric(e.target.value)} 
                 className="bg-white"
               />
             </div>
          </div>
        </div>

        <div className="h-80 bg-white rounded-lg p-4 border border-indigo-50">
           {dynamicStatsData.length === 0 ? (
             <div className="h-full flex items-center justify-center text-slate-400">
               No hay datos disponibles con los filtros actuales.
             </div>
           ) : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={dynamicStatsData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} />
                 <XAxis 
                    dataKey="name" 
                    stroke="#6366f1" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    angle={-45} 
                    textAnchor="end"
                    interval={0}
                 />
                 <YAxis stroke="#6366f1" fontSize={11} tickLine={false} axisLine={false} />
                 <Tooltip 
                   cursor={{ fill: '#eef2ff' }}
                   contentStyle={{ borderRadius: '8px', border: '1px solid #c7d2fe', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   formatter={(value: number) => value.toLocaleString()}
                 />
                 <Bar 
                    dataKey="value" 
                    name={dynamicMetric === 'cajas' ? 'Cajas' : dynamicMetric === 'pallets' ? 'Pallets' : 'Kilos'} 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                 />
               </BarChart>
             </ResponsiveContainer>
           )}
        </div>
      </div>


      {/* Stats 3: Detailed Stats Table by Permit */}
      <div className="col-span-1 lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList size={16} />
                Totales Cumplidos por Permiso de Embarque (Filtrado)
             </h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">N° Permiso</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Exportador</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Pallets Carg.</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Cajas Carg.</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase">Neto Cargado</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-green-600 uppercase">Bruto Cargado</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Bruto Permitido</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">% Cumplimiento</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                      {statisticsData.permitTable.map((row, idx) => {
                          const percentage = row.permitGross > 0 ? (row.gross / row.permitGross) * 100 : 0;
                          return (
                              <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-6 py-3 text-sm font-mono text-slate-700 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-slate-600">{row.exportador}</td>
                                  <td className="px-6 py-3 text-sm text-right text-slate-700 font-medium bg-slate-50/50">{row.pallets.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-sm text-right text-slate-700 font-medium">{row.cajas.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-sm text-right text-blue-700 font-medium">{row.net.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-sm text-right text-green-700 font-bold">{row.gross.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-sm text-right text-slate-500">{row.permitGross.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          percentage > 100 ? 'bg-red-100 text-red-800' : 
                                          percentage >= 98 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                          {percentage.toFixed(1)}%
                                      </span>
                                  </td>
                              </tr>
                          )
                      })}
                      {/* Footer Row for Stats */}
                      <tr className="bg-slate-100 font-bold text-slate-800">
                          <td className="px-6 py-3" colSpan={2}>TOTALES (FILTRADOS)</td>
                          <td className="px-6 py-3 text-right">{statisticsData.permitTable.reduce((a,b) => a + b.pallets, 0).toLocaleString()}</td>
                          <td className="px-6 py-3 text-right">{statisticsData.permitTable.reduce((a,b) => a + b.cajas, 0).toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-blue-800">{statisticsData.permitTable.reduce((a,b) => a + b.net, 0).toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-green-800">{statisticsData.permitTable.reduce((a,b) => a + b.gross, 0).toLocaleString()}</td>
                          <td className="px-6 py-3 text-right text-slate-600">{statisticsData.permitTable.reduce((a,b) => a + b.permitGross, 0).toLocaleString()}</td>
                          <td className="px-6 py-3"></td>
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>

      {/* --- ALL PERMISOS GRID --- */}
      <div className="col-span-1 lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
          <h3 className="text-sm font-medium text-blue-800 uppercase tracking-wider flex items-center gap-2">
            <Container size={16} />
            Rejilla de Permisos de Embarque (Edición y Control)
          </h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {PERMISO_COLUMNS.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                        {col.label}
                    </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredPermisos.length === 0 ? (
                 <tr>
                    <td colSpan={PERMISO_COLUMNS.length + 1} className="px-6 py-8 text-center text-sm text-slate-400 italic">No hay permisos visibles con los filtros actuales</td>
                 </tr>
              ) : (
                filteredPermisos.map(permiso => {
                  return (
                    <tr key={permiso.id} className="hover:bg-slate-50 transition-colors">
                      {PERMISO_COLUMNS.map(col => (
                          <td key={col.key} className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                              {renderPermisoCell(permiso, col)}
                          </td>
                      ))}
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => onEditPermiso(permiso)}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDeletePermiso(permiso.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ALL REMITOS GRID --- */}
      <div className="col-span-1 lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ArrowUpRight size={16} />
            Rejilla de Remitos (Detalle Completo Filtrado)
          </h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {dashboardRemitoColumns.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                        {col.label}
                    </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRemitos.length === 0 ? (
                 <tr>
                    <td colSpan={dashboardRemitoColumns.length + 1} className="px-6 py-8 text-center text-sm text-slate-400 italic">No hay remitos visibles con los filtros actuales</td>
                 </tr>
              ) : (
                filteredRemitos.map(remito => {
                  return (
                    <tr key={remito.id} className="hover:bg-slate-50 transition-colors">
                      {dashboardRemitoColumns.map(col => (
                          <td key={col.key} className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                              {renderRemitoCell(remito, col)}
                          </td>
                      ))}
                      <td className="px-4 py-2 text-center">
                         <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => onEditRemito(remito)}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDeleteRemito(remito.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
