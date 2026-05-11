import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EditorPage } from '@/pages/editor';
import { ClassDiagramPage } from '@/pages/class-diagram';
import { getProjectById } from '@/shared/api/projects';
import { useRequireAuth } from '@/shared/auth/guard';

export function DocumentPage() {
  const { isAuthenticated } = useRequireAuth();
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return getProjectById(projectId);
    },
    enabled: Boolean(projectId) && isAuthenticated,
  });

  const document = projectQuery.data?.documents.find((item) => item.id === documentId) ?? null;

  useEffect(() => {
    if (!projectQuery.isLoading && projectQuery.data && !document) {
      toast.error('Document not found');
      navigate(`/project/${projectQuery.data.id}`);
    }
  }, [document, navigate, projectQuery.data, projectQuery.isLoading]);

  if (!isAuthenticated || projectQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!document) return null;

  if (document.type === 'erd') {
    return <EditorPage />;
  }

  if (document.type === 'class-diagram') {
    return <ClassDiagramPage />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
      This document type is planned for a future iteration.
    </div>
  );
}
