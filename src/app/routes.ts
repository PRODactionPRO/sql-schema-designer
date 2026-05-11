import { createBrowserRouter } from 'react-router';
import { ProjectsPage } from '../pages/projects';
import { ProjectHomePage, DocumentPage } from '../pages/project';
import { AuthPage } from '../pages/auth';

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
    Component: ProjectHomePage,
  },
  {
    path: '/project/:projectId/document/:documentId',
    Component: DocumentPage,
  },
]);
