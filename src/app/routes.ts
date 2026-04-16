import { createBrowserRouter } from 'react-router';
import { ProjectsPage } from '../pages/projects';
import { EditorPage } from '../pages/editor';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: ProjectsPage,
  },
  {
    path: '/project/:projectId',
    Component: EditorPage,
  },
]);
