import { createBrowserRouter } from "react-router";
import ComicViewer from "./components/ComicViewer";
import History from "./pages/History";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ComicViewer />,
  },
  {
    path: "/history",
    element: <History />,
  },
]);

export default router;
