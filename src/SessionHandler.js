const ioRedis = require("ioredis");
const whatsappWebJS = require("whatsapp-web.js");
const amqp = require("amqplib");

class SessionHandler {
  constructor(
    redisUrl = "redis://localhost:6379",
    rabbitMqUrl = "amqp://localhost"
  ) {
    this._redisUrl = redisUrl;
    this._rabbitMqUrl = rabbitMqUrl;
    this._clients = new Map();

    this.#initializeConnections();
  }

  async #initializeConnections() {
    this.redis = await new ioRedis(this._redisUrl);
    this.redis.on("error", (err) => {
      throw new Error(err);
    });

    this.amqp_connection = await amqp.connect(this._rabbitMqUrl);
    this.amqp_channel = await this.amqp_connection.createChannel();
  }

  async createClient(
    key = null,
    max_qr_retry = 0,
    puppeteerOptions = { args: ["--no-sandbox"], headless: false }
  ) {
    if (!key) return;

    const client = new whatsappWebJS.Client({
      qrMaxRetries: max_qr_retry,
      puppeteer: puppeteerOptions,
      authStrategy: new whatsappWebJS.LocalAuth({
        clientId: key,
      }),
    });

    client.initialize();
    this._clients.set(key, client);

    client.on("qr", async (qrCode) => {
      await this.redis.setex(
        `instances:${key}:qr_code`,
        60 * 1 /* 1 minute */,
        qrCode
      );
    });

    client.on("ready", async () => {
      await this.#deleteQrCodeRedis(key);
    });

    client.on("authenticated", async () => {
      await this.#deleteQrCodeRedis(key);
      await this.#sendAmqpEvent("authenticated_instance", true, { key: key });
    });

    client.on("disconnected", async () => {
      await this.#sendAmqpEvent("disconnected_instance", true, { key: key });
    });

    client.on("auth_failure", async () => {
      await this.destroyClient(key);
      await this.#sendAmqpEvent("auth_failure_instance", true, { key: key });
    });

    client.on("message", async (message) => {
      await this.#sendAmqpEvent("message_instance", true, {
        key: key,
        message: message,
      });
    });
  }

  async destroyClient(key = null) {
    if (!key) return;
    if (!this._clients.has(key)) return;

    this._clients.get(key).destroy();
    this._clients.delete(key);
    await this.#deleteAllInstanceDataRedis(key);
  }

  async sendMessage(key = null, chatId, message) {
    if (!key) return;
    const client = this._clients.get(key);
    if (client) {
      await client.sendMessage(chatId, {
        message: message,
      });
    }
  }

  hasInstance(key = null) {
    if (!key) return;
    return this._clients.has(key);
  }

  async #deleteQrCodeRedis(key) {
    return await this.redis.del(`instances:${key}:wpp_qr_code`);
  }

  async #deleteAllInstanceDataRedis(key) {
    return await this.redis.del(`instances:${key}:*`);
  }

  async #sendAmqpEvent(queue_name, durable = true, data) {
    if (!queue_name || !data) return;
    await this.amqp_channel.assertQueue(queue_name, { durable: durable });
    this.amqp_channel.sendToQueue(
      queue_name,
      Buffer.from(JSON.stringify(data))
    );
  }
}

module.exports = SessionHandler;
