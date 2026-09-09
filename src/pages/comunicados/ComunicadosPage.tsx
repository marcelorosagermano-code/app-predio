import React, { useState } from 'react';
import { Megaphone, Plus, Search, Calendar, User, Eye, AlertCircle } from 'lucide-react';
import { mockComunicados } from '../../services/mockData';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export const ComunicadosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Mural de Comunicados e Avisos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Publicações e circulares informativas aos condôminos
          </p>
        </div>

        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
          Novo Comunicado
        </Button>
      </div>

      <div className="space-y-4">
        {mockComunicados.map((comunicado) => (
          <Card key={comunicado.id} className="overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={comunicado.importante ? 'danger' : 'indigo'} size="sm">
                    {comunicado.categoria}
                  </Badge>
                  {comunicado.importante && (
                    <Badge variant="danger" size="sm" dot>
                      Aviso Urgente
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  Publicado em {formatDate(comunicado.dataPublicacao)}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                {comunicado.titulo}
              </h3>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {comunicado.conteudo}
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Autor: <strong className="text-slate-700">{comunicado.autorNome}</strong></span>
                <span>{comunicado.leiturasConfirmadas || 0} confirmações de leitura</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
