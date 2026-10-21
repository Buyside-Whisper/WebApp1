import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

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
