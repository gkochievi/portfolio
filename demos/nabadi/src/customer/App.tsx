import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import { ROUTER_MODE, surfaceBasename } from '../surface';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Profile } from './pages/Profile';
import { Services } from './pages/Services';
import { Barbers } from './pages/Barbers';
import { BarberDetail } from './pages/BarberDetail';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Book } from './pages/Book';
import { NotFound } from './pages/NotFound';
import { ErrorPage } from './pages/ErrorPage';
import { RequireAuth } from './auth/RequireAuth';

// The route table below is upstream's, unchanged. What changed is where it is
// mounted: the demo serves this app under a base path, and shares that path
// with the staff console, so the router is told its basename instead of
// assuming the domain root. `hash` is the escape hatch for a host that
// cannot serve an SPA fallback.
const createRouter = ROUTER_MODE === 'hash' ? createHashRouter : createBrowserRouter;

const router = createRouter([
  {
    // Pathless boundary route: any render/loader error in the children lands
    // on the branded 500 page instead of React Router's default screen.
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/services', element: <Services /> },
      { path: '/barbers', element: <Barbers /> },
      { path: '/barbers/:id', element: <BarberDetail /> },
      { path: '/about', element: <About /> },
      { path: '/contact', element: <Contact /> },
      { path: '/book', element: <Book /> },
      {
        path: '/profile',
        element: (
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: surfaceBasename('customer') });

export default function App() {
  return <RouterProvider router={router} />;
}
