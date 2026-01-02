import { useComicViewer } from "../hooks/useComicViewer";
import Toolbar from "./Toolbar";
import ImageViewer from "./ImageViewer";
import Navigation from "./Navigation";

export default function ComicViewer() {
  const { state, actions } = useComicViewer();

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <Toolbar
        onFolderSelect={actions.handleFolderSelect}
        currentFileName={state.files[state.currentIndex]?.name}
        currentIndex={state.currentIndex}
        totalFiles={state.files.length}
        zoom={state.zoom}
        onZoomIn={actions.zoomIn}
        onZoomOut={actions.zoomOut}
        onResetZoom={actions.resetZoom}
        viewMode={state.viewMode}
        onToggleViewMode={actions.toggleViewMode}
        imageWidth={state.imageWidth}
        onImageWidthChange={actions.setImageWidth}
      />

      <div className="flex-1 overflow-hidden relative">
        <ImageViewer
          imageUrl={state.imageUrl}
          currentFileName={state.files[state.currentIndex]?.name}
          zoom={state.zoom}
          onWheel={actions.handleWheel}
          viewMode={state.viewMode}
          imageWidth={state.imageWidth}
          imageUrls={state.imageUrls}
          files={state.files}
        />
      </div>

      {state.viewMode === "page" && (
        <Navigation
          files={state.files}
          currentIndex={state.currentIndex}
          onPrevPage={actions.prevPage}
          onNextPage={actions.nextPage}
          onGoToPage={actions.goToPage}
        />
      )}
    </div>
  );
}
