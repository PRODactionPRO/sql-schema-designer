import type { Relation, RelationType } from '../model/types';
import { Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';

interface RelationToolbarProps {
  relation: Relation;
  position: { x: number; y: number };
  onUpdateType: (type: RelationType) => void;
  onDelete: () => void;
}

export function RelationToolbar({ relation, position, onUpdateType, onDelete }: RelationToolbarProps) {
  const relationTypes: RelationType[] = ['1:1', '1:N', 'N:1', 'N:M'];

  return (
    <div
      className="absolute bg-gray-800 text-white rounded-lg shadow-lg px-2 py-1 flex items-center gap-1 z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -120%)'
      }}
    >
      {relationTypes.map(type => (
        <Button
          key={type}
          onClick={() => onUpdateType(type)}
          variant={relation.type === type ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-3 ${
            relation.type === type 
              ? 'bg-white text-gray-800 hover:bg-white' 
              : 'text-white hover:bg-gray-700'
          }`}
        >
          {type}
        </Button>
      ))}
      
      <div className="w-px h-6 bg-gray-600 mx-1" />
      
      <Button
        onClick={onDelete}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-white hover:bg-red-600"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}