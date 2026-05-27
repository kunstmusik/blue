declare module 'zeromq' {
  export class Request {
    sendTimeout: number;
    receiveTimeout: number;
    linger: number;
    connect(endpoint: string): void;
    close(): void;
    send(data: Buffer | string | Uint8Array): Promise<void>;
    receive(): Promise<[Buffer]>;
  }

  export class Subscriber {
    linger: number;
    connect(endpoint: string): void;
    close(): void;
  }
}
