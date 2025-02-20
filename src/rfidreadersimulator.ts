import {createServer, Server, Socket} from 'net';

export class RfidReaderSimulator {
  port: number;
  server: Server;
  sockets: Set<Socket> = new Set();
  timerHandle: NodeJS.Timeout | null = null;

  constructor(port: number) {
    this.port = port;

    this.server = createServer(socket => {
      if (process.env.VERBOSE_LOG === 'true')
        console.log(
          'New client connection established to',
          socket.remoteAddress,
        );

      this.sockets.add(socket);

      this.sockets;

      socket.on('data', data => {
        if (process.env.VERBOSE_LOG === 'true')
          console.log('Data received:', data);
      });

      socket.on('end', () => {
        if (process.env.VERBOSE_LOG === 'true')
          console.log('Client', socket.remoteAddress, 'disconnected');
        this.sockets.delete(socket);
      });
    });
  }

  initialize() {
    this.server.listen(this.port, '127.0.0.1');
  }

  simulateRead(data: string, rssi: number) {
    const message = JSON.stringify({
      rssi,
      data,
    });

    for (const socket of this.sockets) {
      const buffer = Buffer.alloc(2);
      buffer.writeUint16BE(message.length);
      socket.write(buffer);
      socket.write(message);
    }
  }

  async shutdown() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }

    for (const socket of this.sockets) {
      socket.destroy();
    }
    return new Promise<void>(resolve => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}

// const sim = new RfidReaderSimulator(5678);
