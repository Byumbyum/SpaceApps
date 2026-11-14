import type { EvidenceKind } from '../types';

export function EvidenceTag({ kind }: { kind: EvidenceKind }) {
  return <span className={`evidence evidence-${kind.toLowerCase()}`}>{kind}</span>;
}
