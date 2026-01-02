import { createBrowserRouter } from "react-router";
import ComicViewer from "./components/ComicViewer";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ComicViewer />,
  },
]);

export default router;
