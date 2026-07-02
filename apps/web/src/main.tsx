import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import { AuthProvider } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { LoadingScreen } from "./components/ui/LoadingScreen";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Foods = lazy(() => import("./pages/Foods"));
const Meals = lazy(() => import("./pages/Meals"));
const AiMeals = lazy(() => import("./pages/AiMeals"));
const Week = lazy(() => import("./pages/Week"));
const Goals = lazy(() => import("./pages/Goals"));
const Weight = lazy(() => import("./pages/Weight"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Import = lazy(() => import("./pages/Import"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));

const router = createBrowserRouter(
  [
    { path: "/login", element: <Login /> },
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: "foods", element: <Foods /> },
        { path: "meals", element: <Meals /> },
        { path: "ai-meals", element: <AiMeals /> },
        { path: "week", element: <Week /> },
        { path: "goals", element: <Goals /> },
        { path: "weight", element: <Weight /> },
        { path: "recipes", element: <Recipes /> },
        { path: "import", element: <Import /> },
        { path: "admin", element: <Admin /> },
        { path: "settings", element: <Settings /> }
      ]
    },
    { path: "*", element: <Navigate to="/" /> }
  ],
  { basename: "/" }
);

if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => registration.update())
      .catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Suspense fallback={<LoadingScreen />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster position="top-right" />
    </AuthProvider>
  </React.StrictMode>
);
