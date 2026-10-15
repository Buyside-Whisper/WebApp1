export enum TransferStatus {
  // Being filled in; changes nothing.
  DRAFT = 'draft',
  // Sent: the goods left the source warehouse and are on the way.
  IN_TRANSIT = 'in_transit',
  // The destination confirmed what arrived; that went into its stock. Final.
  RECEIVED = 'received',
  // Called off while in transit: the goods went back into the source warehouse.
  CANCELLED = 'cancelled',
}
