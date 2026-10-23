import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/modal/modal';
import { ProductForm } from '../../products/product-form/product-form';
import { Product, ProductOption, ProductUnit } from '../../products/product.model';
import { ProductService } from '../../products/product.service';
import { SupplierForm } from '../../suppliers/supplier-form/supplier-form';
import { Supplier, SupplierPayload } from '../../suppliers/supplier.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { PickableProduct, ProductPicker } from '../../stock/product-picker/product-picker';
import { WarehouseOption } from '../../warehouses/warehouse.model';
import { WarehouseService } from '../../warehouses/warehouse.service';
import { Receipt, ReceiptPayload, rsProductUnit } from '../receipt.model';
import { ReceiptService } from '../receipt.service';
import { Combobox } from '../../../../shared/combobox/combobox';
import { TranslatePipe } from '../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ColumnHeader, ColumnTable } from '../../../../shared/column-order/column-header';
import { ColumnTools } from '../../../../shared/column-order/column-tools';
import { ColumnOrder } from '../../../../shared/column-order/column-order';

interface EditableLine {
  productId: string | null;
  name: string | null;
  barcode: string | null;
  unit: ProductUnit | null;
  quantity: number;
  unitCost: number;
  rs: { name: string; barcode: string | null; unitId: number | null; unit: string | null } | null;
}

interface SupplierChoice {
  id: string;
  name: string;
  identificationCode: string | null;
}

const today = () => new Date().toLocaleDateString('sv-SE');

@Component({
  selector: 'app-receipt-editor',
  imports: [ColumnHeader, ColumnTable, ColumnTools, TranslatePipe, Combobox, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, ProductPicker, Modal, ProductForm, SupplierForm],
  templateUrl: './receipt-editor.html',
  styleUrl: './receipt-editor.css',
})
export class ReceiptEditor implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly lineColumns = new ColumnOrder('wms-receipt-lines-edit', [
    { key: 'product', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'unit', label: 'Unit' },
    { key: 'pricePerUnit', label: 'Price per unit (₾)' },
    { key: 'lineTotal', label: 'Line total' },
  ]);
  protected readonly rsColumns = new ColumnOrder('wms-receipt-rs-lines', [
    { key: 'onTheWaybill', label: 'On the waybill' },
    { key: 'yourProduct', label: 'Your product' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'pricePerUnit', label: 'Price per unit (₾)' },
    { key: 'lineTotal', label: 'Line total' },
  ]);
  private readonly receiptService = inject(ReceiptService);
  private readonly productService = inject(ProductService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly supplierService = inject(SupplierService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly id = input<string>();

  protected readonly DeleteIcon = Trash2;
  protected readonly PlusIcon = Plus;

  protected readonly canCreateProducts = computed(() => this.auth.user()?.role === 'module_admin');
  protected readonly isProductFormOpen = signal(false);
  protected readonly productNotice = signal('');

  protected readonly warehouses = signal<WarehouseOption[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly code = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly warehouseId = signal('');
  protected readonly supplierId = signal('');
  protected readonly suppliers = signal<SupplierChoice[]>([]);
  protected readonly rsWaybillId = signal<string | null>(null);
  protected readonly rsSeller = signal<{ name: string | null; tin: string | null } | null>(null);
  protected readonly isSupplierFormOpen = signal(false);
  protected readonly supplierNotice = signal('');
  protected readonly supplierOptions = computed(() =>
    this.suppliers().map((supplier) => ({ value: supplier.id, label: supplier.name, hint: supplier.identificationCode })),
  );
  protected readonly linkedSupplier = computed(() => this.suppliers().find((s) => s.id === this.supplierId()) ?? null);
  protected readonly newSupplierDraft = computed<Partial<SupplierPayload> | null>(() => {
    const seller = this.rsSeller();
    if (!seller) {
      return null;
    }
    const tin = seller.tin ?? '';
    return {
      name: seller.name ?? tin,
      type: tin.length === 11 ? 'individual' : 'company',
      identificationCode: /^(\d{9}|\d{11})$/.test(tin) ? tin : null,
    };
  });
  protected readonly waybillNumber = signal('');
  protected readonly date = signal(today());
  protected readonly note = signal('');
  protected readonly lines = signal<EditableLine[]>([]);

  protected readonly myWarehouses = computed(() =>
    this.warehouses().filter((w) => w.mine && w.status === 'active'),
  );
  protected readonly takenIds = computed(() => this.lines().flatMap((line) => (line.productId ? [line.productId] : [])));
  protected readonly unlinkedCount = computed(() => this.lines().filter((line) => !line.productId).length);
  protected readonly total = computed(() =>
    this.lines().reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0),
  );

  ngOnInit(): void {
    this.warehouseService.options().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        if (!this.id() && this.myWarehouses().length === 1) {
          this.warehouseId.set(this.myWarehouses()[0].id);
        }
      },
      error: () => this.errorMessage.set('Could not load warehouses.'),
    });
    this.supplierService.options().subscribe({
      next: (suppliers) =>
        this.suppliers.update((current) => [
          ...suppliers,
          ...current.filter((s) => !suppliers.some((option) => option.id === s.id)),
        ]),
      error: () => this.errorMessage.set('Could not load suppliers.'),
    });
    this.productService.options().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.errorMessage.set('Could not load products.'),
    });
    const carried = (history.state as { error?: string } | null)?.error;
    if (carried) {
      this.errorMessage.set(carried);
    }
    const id = this.id();
    if (id) {
      this.receiptService.get(id).subscribe({
        next: (receipt) => this.fill(receipt),
        error: () => this.errorMessage.set('Could not load the receipt.'),
      });
    }
  }

  addProduct(picked: PickableProduct): void {
    const product = this.products().find((p) => p.id === picked.id)!;
    this.lines.update((lines) => [
      ...lines,
      {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        quantity: 1,
        unitCost: product.costPrice,
        rs: null,
      },
    ]);
  }

  linkProduct(index: number, picked: PickableProduct): void {
    this.lines.update((lines) =>
      lines.map((line, i) =>
        i === index ? { ...line, productId: picked.id, name: picked.name, barcode: picked.barcode, unit: picked.unit } : line,
      ),
    );
  }

  unlinkProduct(index: number): void {
    this.lines.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, productId: null, name: null, barcode: null, unit: null } : line)),
    );
  }

  protected unitProblem(line: EditableLine): string {
    if (!line.rs || !line.unit) {
      return '';
    }
    const expected = rsProductUnit(line.rs);
    if (!expected) {
      return this.i18n.t('The waybill counts it in {value}; products are only pcs or kg. Ask the supplier to correct the waybill, or reject it.', { value: line.rs.unit ?? 'an unknown unit' });
    }
    return expected === line.unit ? '' : this.i18n.t('The waybill says {unit}, but this product is counted in {unit2}.', { unit: line.rs.unit, unit2: line.unit });
  }

  protected readonly linkingIndex = signal<number | null>(null);
  protected readonly newProductDraft = computed(() => {
    const line = this.linkingIndex() === null ? undefined : this.lines()[this.linkingIndex()!];
    return line?.rs
      ? { name: line.rs.name, barcode: line.rs.barcode ?? '', unit: rsProductUnit(line.rs) ?? 'pcs' }
      : null;
  });

  onSupplierCreated(supplier: Supplier): void {
    this.isSupplierFormOpen.set(false);
    this.suppliers.update((list) => [
      ...list,
      { id: supplier.id, name: supplier.name, identificationCode: supplier.identificationCode },
    ]);
    this.supplierId.set(supplier.id);
    this.supplierNotice.set(this.i18n.t('{name} was added to Suppliers and chosen for this receipt.', { name: supplier.name }));
  }

  openProductForm(lineIndex: number | null): void {
    this.productNotice.set('');
    this.linkingIndex.set(lineIndex);
    this.isProductFormOpen.set(true);
  }

  onProductCreated(product: Product): void {
    this.isProductFormOpen.set(false);
    if (product.status !== 'active') {
      this.productNotice.set(this.i18n.t('{name} was added to Products, but it is Not active, so it can\'t be received.', { name: product.name }));
      return;
    }
    this.products.update((products) => [...products, product]);
    const index = this.linkingIndex();
    if (index !== null) {
      this.linkProduct(index, product);
      this.productNotice.set(this.i18n.t('{name} was added to Products and linked to the waybill line.', { name: product.name }));
    } else {
      this.addProduct(product);
      this.productNotice.set(this.i18n.t('{name} was added to Products and to this receipt.', { name: product.name }));
    }
  }

  updateLine(index: number, field: 'quantity' | 'unitCost', value: number): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  save(andPost: boolean): void {
    const payload = this.payload();
    const problem = this.validate(payload, andPost);
    if (problem) {
      this.errorMessage.set(problem);
      return;
    }
    const question = this.rsWaybillId()
      ? 'Post this receipt? The waybill is confirmed in RS (მიღებული), the goods go into the warehouse and the receipt is locked.'
      : 'Post this receipt? The goods go into the warehouse and the receipt is locked.';
    if (andPost && !this.i18n.confirm(question)) {
      return;
    }

    const id = this.id();
    const request = id ? this.receiptService.update(id, payload) : this.receiptService.create(payload);
    this.isSaving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (saved) => (andPost ? this.post(saved) : void this.router.navigate(['/wms/receipts', saved.id])),
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not save the receipt.'),
    });
  }

  private post(saved: Receipt): void {
    this.receiptService.post(saved.id).subscribe({
      next: () => void this.router.navigate(['/wms/receipts', saved.id]),
      error: (error: HttpErrorResponse) => {
        if (this.id()) {
          this.fail(error, 'Could not post the receipt.');
        } else {
          void this.router.navigate(['/wms/receipts', saved.id, 'edit'], {
            state: { error: this.message(error, 'Could not post the receipt.') },
          });
        }
      },
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.isSaving.set(false);
    this.errorMessage.set(this.message(error, fallback));
  }

  private message(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join('. ') : (message ?? fallback);
  }

  private payload(): ReceiptPayload {
    return {
      warehouseId: this.warehouseId(),
      supplierId: this.supplierId() || null,
      waybillNumber: this.waybillNumber().trim() || null,
      date: this.date(),
      note: this.note().trim() || null,
      lines: this.lines().map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity) || 0,
        unitCost: Number(line.unitCost) || 0,
      })),
    };
  }

  private validate(payload: ReceiptPayload, andPost: boolean): string {
    if (this.rsWaybillId()) {
      if (!payload.warehouseId) {
        return 'Choose the warehouse the goods arrive in.';
      }
      if (!andPost) {
        return '';
      }
      if (!payload.supplierId) {
        return 'Choose the supplier before posting.';
      }
      if (this.unlinkedCount()) {
        return this.i18n.t('Link every waybill line to one of your products first ({unlinkedCount} left).', { unlinkedCount: this.unlinkedCount() });
      }
      const problem = this.lines().find((line) => this.unitProblem(line));
      return problem ? `${problem.rs?.name}: ${this.unitProblem(problem)}` : '';
    }
    if (!payload.warehouseId || !payload.supplierId || !payload.date) {
      return 'Warehouse, supplier and date are required.';
    }
    if (andPost && payload.lines.length === 0) {
      return 'Add at least one product before posting.';
    }
    for (const [i, line] of payload.lines.entries()) {
      const { name, unit } = this.lines()[i];
      if (line.quantity <= 0) {
        return this.i18n.t('Enter a quantity for {name}.', { name });
      }
      if (unit === 'pcs' && !Number.isInteger(line.quantity)) {
        return this.i18n.t('{name} is counted in pcs, so its quantity must be whole.', { name });
      }
      if (line.unitCost < 0) {
        return this.i18n.t('The price of {name} can\'t be negative.', { name });
      }
    }
    return '';
  }

  private fill(receipt: Receipt): void {
    if (receipt.status !== 'draft') {
      void this.router.navigate(['/wms/receipts', receipt.id]);
      return;
    }
    this.code.set(receipt.code);
    this.warehouseId.set(receipt.warehouseId);
    this.supplierId.set(receipt.supplierId ?? '');
    this.rsWaybillId.set(receipt.rsWaybillId);
    this.rsSeller.set(receipt.rsWaybillId ? { name: receipt.rsSellerName, tin: receipt.rsSellerTin } : null);
    if (receipt.supplier) {
      const supplier = {
        id: receipt.supplier.id,
        name: receipt.supplier.status === 'active' ? receipt.supplier.name : `${receipt.supplier.name} (inactive)`,
        identificationCode: receipt.supplier.identificationCode,
      };
      this.suppliers.update((list) => (list.some((s) => s.id === supplier.id) ? list : [...list, supplier]));
    }
    this.waybillNumber.set(receipt.waybillNumber ?? '');
    this.date.set(receipt.date);
    this.note.set(receipt.note ?? '');
    this.lines.set(
      (receipt.lines ?? []).map((line) => ({
        productId: line.productId,
        name: line.product?.name ?? null,
        barcode: line.product?.barcode ?? null,
        unit: line.product?.unit ?? null,
        quantity: line.quantity,
        unitCost: line.unitCost,
        rs: line.rsName ? { name: line.rsName, barcode: line.rsBarcode, unitId: line.rsUnitId, unit: line.rsUnit } : null,
      })),
    );
  }
}
