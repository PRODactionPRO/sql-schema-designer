import { createBrowserRouter } from 'react-router';
import { ProjectsPage } from '../pages/projects';
import { EditorPage } from '../pages/editor';
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
    Component: EditorPage,
  },
]);
