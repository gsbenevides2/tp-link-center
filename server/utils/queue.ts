export class Queue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });

      this.next();
    });
  }

  private async next() {
    if (this.running) return;

    const task = this.queue.shift();
    if (!task) return;

    this.running = true;

    try {
      await task();
    } finally {
      this.running = false;
      this.next();
    }
  }
}
