import React, { useState } from 'react';
import { Users, Plus, Calendar, Clock, MapPin, FileCheck, CheckCircle2 } from 'lucide-react';
import { mockAssembleias } from '../../services/mockData';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export const AssembleiasPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Assembleias & Atas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Convocação de reuniões ordinárias, extraordinárias e histórico de deliberações
          </p>
        </div>

        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
          Convocar Assembleia
        </Button>
      </div>

      <div className="space-y-4">
        {mockAssembleias.map((ass) => (
          <Card key={ass.id}>
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <Badge variant={ass.status === 'AGENDADA' ? 'indigo' : 'neutral'} size="sm">
                  {ass.tipo === 'AGO' ? 'Ordinária (AGO)' : 'Extraordinária (AGE)'}
                </Badge>
                <Badge variant={ass.status === 'AGENDADA' ? 'warning' : 'success'} size="sm">
                  {ass.status === 'AGENDADA' ? 'Convocação Aberta' : 'Realizada'}
                </Badge>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                {ass.titulo}
              </h3>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-700">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <strong>1ª Convocação:</strong> {formatDate(ass.dataHoraPrimeiraConvocacao)} às 19h00 | <strong>2ª Convocação:</strong> 19h30
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <strong>Local:</strong> {ass.local}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Ordem do Dia / Pautas:</h4>
                <ul className="space-y-1 text-slate-600 pl-2">
                  {ass.pautas.map((pauta, idx) => (
                    <li key={idx}>• {pauta}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
