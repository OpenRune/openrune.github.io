export class ResizeListener {
  constructor(onResize) {
    this.onResize = onResize; // Callback for handling resize
  }

  handleResize = () => {
    this.onResize(window.innerWidth, window.innerHeight);
  };

  addListeners = () => {
    window.addEventListener('resize', this.handleResize);
  };

  removeListeners = () => {
    window.removeEventListener('resize', this.handleResize);
  };
}
