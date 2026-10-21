export interface PersonRef {
  id: string;
  name: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  registers: number;
  manager: PersonRef | null;
}

export interface StorePayload {
  name: string;
  address: string;
  registers: number;
  managerId: string | null;
}

export interface StoreOptions {
  managers: PersonRef[];
}
