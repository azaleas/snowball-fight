class Network {
  constructor() {
    this.socket = io();
    this._id = null;
    this.socket.on("connect", () => {
      this._id = this.socket.id;
      console.log("Socket connected:", this._id);
    });
    this.socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });
  }

  on(event, handler) {
    this.socket.on(event, handler);
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  get id() {
    return this._id || this.socket.id;
  }
}

export const network = new Network();
