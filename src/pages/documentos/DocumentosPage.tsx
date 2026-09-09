import React, { useState } from 'react';
import { FileText, Plus, Download, Search, Filter, ShieldCheck, Folder } from 'lucide-react';
import { mockDocumentos } from '../../services/mockData';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export const DocumentosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Central de Documentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Convenção, Regimento Interno, Atas e Prestações de Contas (Supabase Storage)
          </p>
        </div>

        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
          Enviar Novo Documento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockDocumentos.map((doc) => (
          <Card key={doc.id} className="flex flex-col justify-between hover:border-slate-300 transition-colors">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="neutral" size="sm">{doc.formato}</Badge>
                <span className="text-[11px] text-slate-400">{doc.tamanhoKb} KB</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2">
                {doc.titulo}
              </h3>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {doc.descricao && (
                <p className="text-xs text-slate-500 line-clamp-2">{doc.descricao}</p>
              )}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>{formatDate(doc.criadoEm)}</span>
                <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
