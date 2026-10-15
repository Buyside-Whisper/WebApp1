// Why stock changed. Each kind belongs to a document type.
export enum StockMovementKind {
  // The quantities that existed before movements were recorded (2026-10-15).
  OPENING = 'opening',
  // Goods receipt (მიღება) posted / cancelled.
  RECEIPT = 'receipt',
  RECEIPT_CANCEL = 'receipt_cancel',
  // Transfer (გადაადგილება): sent from the source, received at the destination, or undone.
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_CANCEL = 'transfer_cancel',
}
