import { Camera, Loader2 } from 'lucide-react';

interface SnapshotOverlayProps {
  onSave: () => void;
  onCancel: () => void;
  isCapturing?: boolean;
}

export function SnapshotOverlay({ onSave, onCancel, isCapturing }: SnapshotOverlayProps) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-20 border-4 border-blue-500/30 rounded-none" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gray-900/90 backdrop-blur text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2">
        {isCapturing ? (
          <>
            <Loader2 className="size-4 text-blue-400 animate-spin" />
            Capturing snapshot…
          </>
        ) : (
          <>
            <Camera className="size-4 text-blue-400" />
            Position your schema for the snapshot
          </>
        )}
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
        <button
          onClick={onCancel}
          disabled={isCapturing}
          className="px-5 py-3 bg-gray-800/90 backdrop-blur text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontWeight: 500 }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isCapturing}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontWeight: 600 }}
        >
          {isCapturing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {isCapturing ? 'Capturing…' : 'Save Snapshot'}
        </button>
      </div>
    </>
  );
}
