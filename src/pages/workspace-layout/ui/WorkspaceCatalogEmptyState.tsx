export function WorkspaceCatalogEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
        {children}
      </div>
    </div>
  );
}
