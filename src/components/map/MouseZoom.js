export class MouseZoom {
  constructor(mapView, onZoom) {
    this.mapView = mapView;
    this.onZoom = onZoom; // Callback to handle zoom logic
  }

  handleWheel = (e) => {
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.onZoom(zoomFactor);
  };

  addListeners = (element) => {
    element.addEventListener('wheel', this.handleWheel);
  };

  removeListeners = (element) => {
    element.removeEventListener('wheel', this.handleWheel);
  };
}
