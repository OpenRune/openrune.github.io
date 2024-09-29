export class MouseHover {
  constructor(onHover) {
    this.onHover = onHover; // Callback for handling hover logic
  }

  handleMouseMove = (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    this.onHover(mouseX, mouseY);
  };

  addListeners = (element) => {
    element.addEventListener('mousemove', this.handleMouseMove);
  };

  removeListeners = (element) => {
    element.removeEventListener('mousemove', this.handleMouseMove);
  };
}
