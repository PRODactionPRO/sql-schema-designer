import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { Domain, Table } from '../../model/types';

interface UseDomainsPanelViewModelParams {
  domains: Domain[];
  tables: Table[];
  isAddingDomain: boolean;
  setIsAddingDomain: React.Dispatch<React.SetStateAction<boolean>>;
  newDomainName: string;
  setNewDomainName: React.Dispatch<React.SetStateAction<string>>;
  editingDomainId: string | null;
  setEditingDomainId: React.Dispatch<React.SetStateAction<string | null>>;
  renamingDomainId: string | null;
  setRenamingDomainId: React.Dispatch<React.SetStateAction<string | null>>;
  renamingDomainName: string;
  setRenamingDomainName: React.Dispatch<React.SetStateAction<string>>;
  hasMultiSelection: boolean;
  selectedTableIds: Set<string>;
  onAssignDomain: (domainId: string, tableIds: string[]) => void;
  onUpdateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  onDeleteDomain: (id: string) => void;
  handleAddDomain: () => void;
}

export interface DomainsPanelViewModel {
  domains: Domain[];
  tables: Table[];
  isAddingDomain: boolean;
  newDomainName: string;
  editingDomainId: string | null;
  renamingDomainId: string | null;
  renamingDomainName: string;
  hasMultiSelection: boolean;
  selectedTableIds: Set<string>;
  onStartAddDomain: () => void;
  onCancelAddDomain: () => void;
  onConfirmAddDomain: () => void;
  onChangeNewDomainName: (value: string) => void;
  onSetEditingDomainId: (id: string | null) => void;
  onSetRenamingDomainId: (id: string | null) => void;
  onSetRenamingDomainName: (name: string) => void;
  onAssignDomain: (domainId: string, tableIds: string[]) => void;
  onUpdateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  onDeleteDomain: (id: string) => void;
}

export function useDomainsPanelViewModel({
  domains,
  tables,
  isAddingDomain,
  setIsAddingDomain,
  newDomainName,
  setNewDomainName,
  editingDomainId,
  setEditingDomainId,
  renamingDomainId,
  setRenamingDomainId,
  renamingDomainName,
  setRenamingDomainName,
  hasMultiSelection,
  selectedTableIds,
  onAssignDomain,
  onUpdateDomain,
  onDeleteDomain,
  handleAddDomain,
}: UseDomainsPanelViewModelParams): DomainsPanelViewModel {
  const onStartAddDomain = useCallback(() => setIsAddingDomain(true), [setIsAddingDomain]);
  const onCancelAddDomain = useCallback(() => {
    setIsAddingDomain(false);
    setNewDomainName('');
  }, [setIsAddingDomain, setNewDomainName]);
  const onChangeNewDomainName = useCallback((value: string) => setNewDomainName(value), [setNewDomainName]);
  const onSetEditingDomainId = useCallback((id: string | null) => setEditingDomainId(id), [setEditingDomainId]);
  const onSetRenamingDomainId = useCallback((id: string | null) => setRenamingDomainId(id), [setRenamingDomainId]);
  const onSetRenamingDomainName = useCallback((name: string) => setRenamingDomainName(name), [setRenamingDomainName]);

  return useMemo(() => ({
    domains,
    tables,
    isAddingDomain,
    newDomainName,
    editingDomainId,
    renamingDomainId,
    renamingDomainName,
    hasMultiSelection,
    selectedTableIds,
    onStartAddDomain,
    onCancelAddDomain,
    onConfirmAddDomain: handleAddDomain,
    onChangeNewDomainName,
    onSetEditingDomainId,
    onSetRenamingDomainId,
    onSetRenamingDomainName,
    onAssignDomain,
    onUpdateDomain,
    onDeleteDomain,
  }), [
    domains,
    editingDomainId,
    handleAddDomain,
    hasMultiSelection,
    isAddingDomain,
    newDomainName,
    onAssignDomain,
    onCancelAddDomain,
    onChangeNewDomainName,
    onDeleteDomain,
    onSetEditingDomainId,
    onSetRenamingDomainId,
    onSetRenamingDomainName,
    onStartAddDomain,
    onUpdateDomain,
    renamingDomainId,
    renamingDomainName,
    selectedTableIds,
    tables,
  ]);
}
