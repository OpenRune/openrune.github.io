export class MouseDrag {
  constructor(mapView, onDrag) {
    this.mapView = mapView;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.onDrag = onDrag; // Callback for updating drag logic
  }

  handleMouseDown = (e) => {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  };

  handleMouseMove = (e) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    this.onDrag(deltaX, deltaY);

    this.startX = e.clientX;
    this.startY = e.clientY;
  };

  handleMouseUp = () => {
    this.isDragging = false;
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  };

  addListeners = (element) => {
    element.addEventListener('mousedown', this.handleMouseDown);
  };

  removeListeners = (element) => {
    element.removeEventListener('mousedown', this.handleMouseDown);
  };
}
