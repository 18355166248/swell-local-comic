import { createBrowserRouter } from "react-router";
import AppShell from "./components/AppShell";
import ComicViewer from "./components/ComicViewer";
import History from "./pages/History";
import LibraryDetail from "./pages/LibraryDetail";
import LibraryHome from "./pages/LibraryHome";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <LibraryHome />,
      },
      {
        path: "library",
        element: <LibraryDetail />,
      },
      {
        path: "history",
        element: <History />,
      },
    ],
  },
  {
    path: "/viewer",
    element: <ComicViewer />,
  },
]);

export default router;
