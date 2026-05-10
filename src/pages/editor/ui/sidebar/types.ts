import type { Domain, Table } from '../../model/types';

export type SidebarTab = 'tables' | 'domains';

export interface SidebarTableGroup {
  domainId: string | null;
  domain: Domain | null;
  label?: string;
  tables: Table[];
}

export interface SidebarPendingMove {
  tableId: string;
  targetDomainId: string | null;
  targetDomainName: string;
}
