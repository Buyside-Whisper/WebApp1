export enum ReceiptStatus {
  // Being filled in; changes nothing.
  DRAFT = 'draft',
  // Confirmed: the stock went into the warehouse. Locked.
  POSTED = 'posted',
  // Undone after posting: the stock was taken back out.
  CANCELLED = 'cancelled',
}
