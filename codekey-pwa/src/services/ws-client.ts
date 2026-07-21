type WsEvent = 'connected' | 'disconnected' | 'auth_failed' | 'device_online' | 'device_offline';
type MessageHandler = (payload?: any) => void;

const RECONNECT_INTERVAL_MS = 3000;

export class WsClient {
  private ws: WebSocket | null = null;
  private destroyed = false;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Map<WsEvent, Set<MessageHandler>>();

  constructor(
    private relayUrl: string,
    private deviceId: string,
    private token: string,
  ) {}

  connect(): void {
    if (this.destroyed) return;

    const url = this.relayUrl + '?device_id=' + this.deviceId + '&token=' + this.token;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.startHeartbeat();
      this.emit('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') return;
        if (msg.type === 'auth_failed') {
          this.emit('auth_failed', msg.payload || { code: msg.code || 'unknown' });
          return;
        }
        if (msg.type === 'device_online' || msg.type === 'device_offline') {
          this.emit(msg.type, msg.payload || msg);
        }
      } catch { /* drop malformed */ }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      this.clearReconnectTimer();
      this.ws = null;
      this.emit('disconnected');

      if (event.code === 4001) {
        this.destroyed = true;
        this.emit('auth_failed', { code: 'DEVICE_UNBOUND' });
        return;
      }

      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_INTERVAL_MS);
      }
    };

    this.ws.onerror = () => { /* onclose handles */ };
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.ws?.close();
    this.ws = null;
  }

  on(event: WsEvent, handler: MessageHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: WsEvent, handler: MessageHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: WsEvent, payload?: any): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }));
      }
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = undefined; }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) { clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; }
  }
}
