import type { EvaluationStatus, Severity } from '../types';
import { Badge } from './ui';
import { STATUS_SHORT } from '../lib/calc';

export const StatusBadge = ({ status }: { status: EvaluationStatus }) => {
  const tone = status === 'MEMENUHI' ? 'green' : status === 'PERLU_PERBAIKAN' ? 'red' : status === 'KURANG_DIMENSI_TERTOLERANSI' ? 'amber' : 'slate';
  return <Badge tone={tone}>{STATUS_SHORT[status]}</Badge>;
};

export const SeverityBadge = ({ s }: { s: Severity }) => <Badge tone={s === 'KRITIS' ? 'red' : s === 'MAYOR' ? 'orange' : 'amber'}>{s}</Badge>;
