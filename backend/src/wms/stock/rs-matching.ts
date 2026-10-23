import { DataSource, EntityManager, In } from 'typeorm';
import { nameKey } from '../../common/name-key.js';
import { RsWaybillGoods } from '../../rs/waybills/rs-client.js';
import { Product } from '../products/product.entity.js';
import { ProductUnit } from '../products/product-unit.enum.js';
import { RsProductLink } from './rs-product-link.entity.js';

export const RS_UNITS: Record<number, ProductUnit> = { 1: ProductUnit.PCS, 2: ProductUnit.KG };

const RS_OTHER_UNIT = 99;

const UNIT_WORDS: Record<string, ProductUnit> = {
  'ცალი': ProductUnit.PCS,
  'ც': ProductUnit.PCS,
  pcs: ProductUnit.PCS,
  'კგ': ProductUnit.KG,
  'კილოგრამი': ProductUnit.KG,
  kg: ProductUnit.KG,
};

export function rsProductUnit(line: Pick<RsSnapshotLine, 'rsUnitId' | 'rsUnit'>): ProductUnit | undefined {
  if (line.rsUnitId === RS_OTHER_UNIT) {
    return UNIT_WORDS[(line.rsUnit ?? '').trim().toLowerCase().replace(/\.$/, '')];
  }
  return line.rsUnitId !== null ? RS_UNITS[line.rsUnitId] : undefined;
}

export const goodsKey = (goods: { barcode: string | null; name: string }) =>
  goods.barcode?.trim() ? goods.barcode.trim() : `name:${nameKey(goods.name)}`;

export interface RsSnapshotLine {
  rsName: string | null;
  rsBarcode: string | null;
  rsUnitId: number | null;
  rsUnit: string | null;
}

export function rsUnitProblem(line: RsSnapshotLine, product: Pick<Product, 'name' | 'unit'> | undefined): string {
  const expected = rsProductUnit(line);
  if (expected && expected === product?.unit) {
    return '';
  }
  return `${line.rsName}: the waybill counts it in ${line.rsUnit ?? 'an unknown unit'}, but ${product?.name} is counted in ${product?.unit}. Ask for the waybill to be corrected, or don't use it.`;
}

export async function matchRsProducts(
  dataSource: DataSource,
  companyId: string,
  sellerTin: string,
  goods: RsWaybillGoods[],
): Promise<(Product | null)[]> {
  const links = await dataSource.getRepository(RsProductLink).find({
    where: { companyId, sellerTin, goodsKey: In(goods.map(goodsKey)) },
  });
  const linked = new Map(links.map((link) => [link.goodsKey, link.productId]));
  const barcodes = goods.flatMap((g) => (g.barcode?.trim() ? [g.barcode.trim()] : []));
  const candidates = await dataSource.getRepository(Product).find({
    where: [
      ...(linked.size ? [{ companyId, id: In([...linked.values()]) }] : []),
      ...(barcodes.length ? [{ companyId, barcode: In(barcodes) }] : []),
    ],
  });
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const byBarcode = new Map(candidates.map((p) => [p.barcode, p]));
  return goods.map((g) => {
    const fromLink = linked.get(goodsKey(g));
    return (fromLink && byId.get(fromLink)) || (g.barcode?.trim() && byBarcode.get(g.barcode.trim())) || null;
  });
}

export async function rememberRsProducts(
  manager: EntityManager,
  companyId: string,
  sellerTin: string | null | undefined,
  lines: RsSnapshotLine[],
  productIds: (string | null)[],
): Promise<void> {
  if (!sellerTin) {
    return;
  }
  for (const [i, line] of lines.entries()) {
    const productId = productIds[i];
    if (!productId || !line.rsName) {
      continue;
    }
    await manager
      .createQueryBuilder()
      .insert()
      .into(RsProductLink)
      .values({ companyId, sellerTin, goodsKey: goodsKey({ barcode: line.rsBarcode, name: line.rsName }), productId })
      .orUpdate(['product_id', 'updated_at'], ['company_id', 'seller_tin', 'goods_key'])
      .execute();
  }
}
