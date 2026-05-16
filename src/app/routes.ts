import { createBrowserRouter } from 'react-router';
import { ProjectsPage } from '../pages/projects';
import { ProjectHomePage, DocumentPage } from '../pages/project';
import { AuthPage } from '../pages/auth';
import { WorkspaceLayoutPage } from '../pages/workspace-layout';

export const router = createBrowserRouter([
  {
    path: '/auth',
    Component: AuthPage,
  },
  {
    path: '/',
    Component: ProjectsPage,
  },
  {
    path: '/project/:projectId',
    Component: WorkspaceLayoutPage,
  },
  {
    path: '/project/:projectId/home',
    Component: ProjectHomePage,
  },
  {
    path: '/project/:projectId/document/:documentId',
    Component: DocumentPage,
  },
  {
    path: '/workspace-layout',
    Component: WorkspaceLayoutPage,
  },
]);
