class AsyncJobQueue {
  constructor({ handler, getConcurrency }) {
    this.handler = handler;
    this.getConcurrency = typeof getConcurrency === 'function' ? getConcurrency : () => 1;
    this.running = 0;
    this.items = [];
    this.keys = new Set();
  }

  has(key) {
    return this.keys.has(key);
  }

  enqueue(key, payload) {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.items.push({ key, payload });
    this.pump();
    return true;
  }

  pump() {
    const concurrency = Math.max(1, Number(this.getConcurrency() || 1));
    while (this.running < concurrency && this.items.length > 0) {
      const job = this.items.shift();
      this.running += 1;
      Promise.resolve(this.handler(job.payload))
        .catch(() => {})
        .finally(() => {
          this.running -= 1;
          this.keys.delete(job.key);
          this.pump();
        });
    }
  }
}

module.exports = { AsyncJobQueue };
