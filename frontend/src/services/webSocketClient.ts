import { ChunkScoringResult } from '../types';

export type WebSocketStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface WebSocketCallbacks {
  onMessage: (data: ChunkScoringResult) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketCallbacks | null = null;
  private url = '';
  public status: WebSocketStatus = 'DISCONNECTED';

  connect(wsUrl: string, callbacks: WebSocketCallbacks, timeoutMs = 8000): Promise<void> {
    this.url = wsUrl;
    this.callbacks = callbacks;
    this.updateStatus('CONNECTING');

    return new Promise<void>((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        const socket = new WebSocket(wsUrl);
        this.ws = socket;
        this.ws.binaryType = 'arraybuffer';

        let isResolved = false;
        const timer = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.updateStatus('ERROR');
            reject(new Error(`WebSocket connection to ${wsUrl} timed out after ${timeoutMs}ms.`));
          }
        }, timeoutMs);

        socket.onopen = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            this.updateStatus('CONNECTED');
            if (this.callbacks?.onOpen) {
              this.callbacks.onOpen();
            }
            resolve();
          }
        };

        socket.onmessage = (event: MessageEvent) => {
          try {
            let data: ChunkScoringResult;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else {
              const decoder = new TextDecoder('utf-8');
              data = JSON.parse(decoder.decode(event.data));
            }
            data.timestamp = new Date().toISOString();
            if (this.callbacks?.onMessage) {
              this.callbacks.onMessage(data);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket incoming JSON score:', err, event.data);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket encountered error:', error);
          this.updateStatus('ERROR');
          if (this.callbacks?.onError) {
            this.callbacks.onError(error);
          }
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            reject(new Error('WebSocket connection failed. Please ensure the backend is running.'));
          }
        };

        socket.onclose = (event) => {
          this.updateStatus('DISCONNECTED');
          if (this.callbacks?.onClose) {
            this.callbacks.onClose(event);
          }
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            reject(new Error(`WebSocket connection closed (code ${event.code}). Please ensure the backend server is running.`));
          }
        };
      } catch (err) {
        console.error('WebSocket connection initialization failure:', err);
        this.updateStatus('ERROR');
        reject(err);
      }
    });
  }

  sendBinary(binaryFrame: ArrayBuffer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(binaryFrame);
      return true;
    }
    console.warn('Cannot send binary frame: WebSocket is not open (readyState =', this.ws?.readyState, ')');
    return false;
  }

  sendJson(payload: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    console.warn('Cannot send JSON frame: WebSocket is not open');
    return false;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus('DISCONNECTED');
  }

  private updateStatus(newStatus: WebSocketStatus): void {
    this.status = newStatus;
    if (this.callbacks?.onStatusChange) {
      this.callbacks.onStatusChange(newStatus);
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
