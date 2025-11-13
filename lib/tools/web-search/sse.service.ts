// Type alias for Express-like Response interface (legacy code)
type Response = {
  write: (data: string) => void;
  on: (event: string, callback: () => void) => void;
};

class SseService {
  private clients = new Map<string, Response>();

  addClient(clientId: string, clientResponse: Response) {
    this.clients.set(clientId, clientResponse);
    clientResponse.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  sendEvent(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}

`);
    }
  }
}

export const sseService = new SseService();
