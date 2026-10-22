import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

const RS_URL = process.env.RS_WAYBILL_SERVICE_URL ?? 'https://services.rs.ge/WayBillService/WayBillService.asmx';
const TIMEOUT_MS = 30_000;
const LIST_TIMEOUT_MS = 90_000;
const REFERENCE_TTL_MS = 12 * 60 * 60 * 1000;

export interface RsCredentials {
  username: string;
  password: string;
}

export type RsConfirmation = 'pending' | 'accepted' | 'rejected';

export interface RsWaybillSummary {
  id: string;
  number: string;
  typeId: number | null;
  typeName: string | null;
  status: number | null;
  confirmation: RsConfirmation;
  sellerTin: string | null;
  sellerName: string | null;
  buyerTin: string | null;
  buyerName: string | null;
  startAddress: string | null;
  endAddress: string | null;
  driverName: string | null;
  driverTin: string | null;
  carNumber: string | null;
  amount: number;
  transportCost: number;
  createdAt: string | null;
  activatedAt: string | null;
  deliveredAt: string | null;
  comment: string | null;
  parentId: string | null;
  corrected: boolean;
}

export interface RsWaybillGoods {
  name: string;
  barcode: string | null;
  unitId: number | null;
  unitName: string | null;
  quantity: number;
  price: number;
  amount: number;
}

export interface RsWaybillDetail extends RsWaybillSummary {
  amountInWords: string | null;
  transportName: string | null;
  confirmedAt: string | null;
  invoiceId: string | null;
  totalQuantity: number | null;
  goods: RsWaybillGoods[];
}

const ERRORS: Record<string, string> = {
  '-100': 'RS rejected the service user or password',
  '-101': 'RS: this company may not do this with the waybill',
  '-1': 'RS could not find the waybill',
};

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  const value = match ? decode(match[1]).trim() : '';
  return value === '' ? null : value;
}

function blocks(xml: string, name: string): string[] {
  return xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, 'g')) ?? [];
}

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function rsDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const short = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (short) {
    const month = MONTHS[short[2].toUpperCase()];
    const year = short[3].length === 2 ? `20${short[3]}` : short[3];
    return month ? `${year}-${month}-${short[1].padStart(2, '0')}T00:00:00` : null;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !value.startsWith('0001-') ? value : null;
}

function tbilisiDateTime(value: Date): string {
  const parts = new Map(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}:${parts.get('second')}`;
}

const num = (value: string | null) => (value === null || Number.isNaN(Number(value)) ? null : Number(value));

function confirmationOf(value: string | null): RsConfirmation {
  return value === '1' ? 'accepted' : value === '-1' ? 'rejected' : 'pending';
}

@Injectable()
export class RsClient {
  private readonly logger = new Logger(RsClient.name);
  private references: { types: Map<number, string>; units: Map<number, string>; loadedAt: number } | null = null;

  async checkServiceUser(credentials: RsCredentials): Promise<{ ok: boolean; unId: number | null; userId: number | null }> {
    const body = await this.call('chek_service_user', credentials, '');
    const ok = tag(body, 'chek_service_userResult') === 'true';
    return { ok, unId: ok ? num(tag(body, 'un_id')) : null, userId: ok ? num(tag(body, 's_user_id')) : null };
  }

  async buyerWaybills(credentials: RsCredentials, from: string, to: string): Promise<RsWaybillSummary[]> {
    const body = await this.call(
      'get_buyer_waybills',
      credentials,
      [
        '<itypes></itypes><seller_tin></seller_tin><statuses></statuses><car_number></car_number>',
        `<create_date_s>${from}T00:00:00</create_date_s>`,
        `<create_date_e>${to}T23:59:59</create_date_e>`,
        '<driver_tin></driver_tin><waybill_number></waybill_number><s_user_ids></s_user_ids><comment></comment>',
      ].join(''),
      LIST_TIMEOUT_MS,
    );
    const result = this.result(body, 'get_buyer_waybillsResult');
    const { types } = await this.loadReferences(credentials);
    return blocks(result, 'WAYBILL').map((xml) => this.summary(xml, types));
  }

  async waybill(credentials: RsCredentials, id: string): Promise<RsWaybillDetail> {
    const body = await this.call('get_waybill', credentials, `<waybill_id>${escape(id)}</waybill_id>`);
    const result = this.result(body, 'get_waybillResult');
    const { types, units } = await this.loadReferences(credentials);
    const goodsXml = result.match(/<GOODS_LIST>([\s\S]*?)<\/GOODS_LIST>/)?.[1] ?? '';
    const head = result.replace(/<(GOODS_LIST|SUB_WAYBILLS|WOOD_DOCS_LIST)>[\s\S]*?<\/\1>/g, '');
    if (!tag(head, 'ID')) {
      throw new BadGatewayException(ERRORS['-1']);
    }
    return {
      ...this.summary(head, types),
      amountInWords: tag(head, 'FULL_AMOUNT_TXT'),
      transportName: tag(head, 'TRANS_TXT'),
      confirmedAt: rsDate(tag(head, 'CONFIRMATION_DATE')),
      invoiceId: tag(head, 'INVOICE_ID'),
      totalQuantity: num(tag(head, 'TOTAL_QUANTITY')),
      goods: blocks(goodsXml, 'GOODS').map(
        (xml) => {
          const unitId = num(tag(xml, 'UNIT_ID'));
          return {
            name: tag(xml, 'W_NAME') ?? '',
            barcode: tag(xml, 'BAR_CODE'),
            unitId,
            unitName: tag(xml, 'UNIT_TXT') ?? (unitId !== null ? (units.get(unitId) ?? null) : null),
            quantity: num(tag(xml, 'QUANTITY')) ?? 0,
            price: num(tag(xml, 'PRICE')) ?? 0,
            amount: num(tag(xml, 'AMOUNT')) ?? 0,
          };
        },
      ),
    };
  }

  async confirmWaybill(credentials: RsCredentials, id: string): Promise<boolean> {
    const body = await this.call('confirm_waybill', credentials, `<waybill_id>${escape(id)}</waybill_id>`);
    return tag(body, 'confirm_waybillResult') === 'true';
  }

  async rejectWaybill(credentials: RsCredentials, id: string): Promise<boolean> {
    const body = await this.call('reject_waybill', credentials, `<waybill_id>${escape(id)}</waybill_id>`);
    return tag(body, 'reject_waybillResult') === 'true';
  }

  async closeWaybill(credentials: RsCredentials, id: string, deliveredAt: Date): Promise<string> {
    const body = await this.call(
      'close_waybill_vd',
      credentials,
      `<delivery_date>${tbilisiDateTime(deliveredAt)}</delivery_date><waybill_id>${escape(id)}</waybill_id>`,
    );
    return tag(body, 'close_waybill_vdResult') ?? '';
  }

  errorText(code: string): string {
    return ERRORS[code] ?? `RS returned ${code || 'nothing'}`;
  }

  private summary(xml: string, types: Map<number, string>): RsWaybillSummary {
    const typeId = num(tag(xml, 'TYPE'));
    return {
      id: tag(xml, 'ID') ?? '',
      number: tag(xml, 'WAYBILL_NUMBER') ?? '',
      typeId,
      typeName: typeId !== null ? (types.get(typeId) ?? null) : null,
      status: num(tag(xml, 'STATUS')),
      confirmation: confirmationOf(tag(xml, 'IS_CONFIRMED')),
      sellerTin: tag(xml, 'SELLER_TIN'),
      sellerName: tag(xml, 'SELLER_NAME'),
      buyerTin: tag(xml, 'BUYER_TIN'),
      buyerName: tag(xml, 'BUYER_NAME'),
      startAddress: tag(xml, 'START_ADDRESS'),
      endAddress: tag(xml, 'END_ADDRESS'),
      driverName: tag(xml, 'DRIVER_NAME'),
      driverTin: tag(xml, 'DRIVER_TIN'),
      carNumber: tag(xml, 'CAR_NUMBER'),
      amount: num(tag(xml, 'FULL_AMOUNT')) ?? 0,
      transportCost: num(tag(xml, 'TRANSPORT_COAST')) ?? 0,
      createdAt: rsDate(tag(xml, 'CREATE_DATE')),
      activatedAt: rsDate(tag(xml, 'ACTIVATE_DATE') ?? tag(xml, 'BEGIN_DATE')),
      deliveredAt: rsDate(tag(xml, 'DELIVERY_DATE') ?? tag(xml, 'CLOSE_DATE')),
      comment: tag(xml, 'WAYBILL_COMMENT') ?? tag(xml, 'COMMENT'),
      parentId: tag(xml, 'PAR_ID'),
      corrected: tag(xml, 'IS_CORRECTED') === '1',
    };
  }

  private result(body: string, resultTag: string): string {
    const raw = body.match(new RegExp(`<${resultTag}>([\\s\\S]*)</${resultTag}>`))?.[1] ?? '';
    const result = raw.includes('&lt;') ? decode(raw) : raw;
    const status = result.match(/^\s*<RESULT[^>]*>[\s\S]*?<STATUS>(-?\d+)<\/STATUS>/)?.[1];
    if (status && Number(status) < 0) {
      throw new BadGatewayException(ERRORS[status] ?? `RS returned error ${status}`);
    }
    return result;
  }

  private async loadReferences(credentials: RsCredentials) {
    if (this.references && Date.now() - this.references.loadedAt < REFERENCE_TTL_MS) {
      return this.references;
    }
    const read = async (operation: string, itemTag: string) => {
      const body = await this.call(operation, credentials, '');
      const result = this.result(body, `${operation}Result`);
      return new Map(
        blocks(result, itemTag).flatMap((xml) => {
          const id = num(tag(xml, 'ID'));
          const name = tag(xml, 'NAME');
          return id !== null && name ? [[id, name] as const] : [];
        }),
      );
    };
    try {
      const [types, units] = await Promise.all([
        read('get_waybill_types', 'WAYBILL_TYPE'),
        read('get_waybill_units', 'WAYBILL_UNIT'),
      ]);
      this.references = { types, units, loadedAt: Date.now() };
      return this.references;
    } catch (error) {
      this.logger.warn(`Could not load RS reference lists: ${(error as Error).message}`);
      return { types: new Map<number, string>(), units: new Map<number, string>(), loadedAt: 0 };
    }
  }

  private async call(
    operation: string,
    credentials: RsCredentials,
    inner: string,
    timeoutMs = TIMEOUT_MS,
  ): Promise<string> {
    const envelope =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      `<soap:Body><${operation} xmlns="http://tempuri.org/">` +
      `<su>${escape(credentials.username)}</su><sp>${escape(credentials.password)}</sp>${inner}` +
      `</${operation}></soap:Body></soap:Envelope>`;
    let response: Response;
    try {
      response = await fetch(RS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://tempuri.org/${operation}"` },
        body: envelope,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(`RS ${operation} failed: ${(error as Error).message}`);
      throw new BadGatewayException(
        (error as Error).name === 'TimeoutError'
          ? 'RS did not answer in time. Try again, or choose a shorter period.'
          : 'Could not reach RS. Try again in a minute.',
      );
    }
    const text = await response.text();
    if (!response.ok) {
      this.logger.warn(`RS ${operation} answered HTTP ${response.status}`);
      throw new BadGatewayException(`RS answered with an error (HTTP ${response.status})`);
    }
    return text;
  }
}
