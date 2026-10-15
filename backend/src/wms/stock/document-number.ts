import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

// The next number of a company's documents of one kind (1, 2, 3, …), e.g. receipts → REC-000003.
// Call it inside the transaction that saves the document: the advisory lock makes a second document
// of the same kind wait until this one is saved, so two people never get the same number.
export async function nextDocumentNumber<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  companyId: string,
  lockName: string,
): Promise<number> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${lockName}:${companyId}`]);
  const row = await manager
    .createQueryBuilder(entity, 'doc')
    .select('COALESCE(MAX(doc.number), 0)', 'max')
    .where('doc.company_id = :companyId', { companyId })
    .getRawOne<{ max: string }>();
  return Number(row?.max ?? 0) + 1;
}

export const formatDocumentNumber = (prefix: string, number: number) =>
  `${prefix}-${String(number).padStart(6, '0')}`;
