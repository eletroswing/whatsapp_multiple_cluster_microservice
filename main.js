const dotenv = require("dotenv");
const amqp = require("amqplib");
const SessionHandler = require("./src/SessionHandler.js");
const healthChecker = require("./utils/health_checker.js");

(async () => {
  dotenv.config();

  var creationAvailable = true;

  const amqpUrl = process.env.RABBIT_MQ_URL || "amqp://localhost";
  const redisUrl = process.env.REDIS_URL || "redis://localhost";

  const amqpConnection = await amqp.connect(amqpUrl);
  const amqpChannel = await amqpConnection.createChannel();

  const multipleWppSessionHandler = new SessionHandler(redisUrl, amqpUrl);

  setInterval(performHealthCheck, 10000);

  await assertQueueList([
    "send_message",
    "create_instance",
    "destroy_instance",
  ]);

  let creationConsumer = await performCreationConsumer();

  await amqpChannel.consume(
    "destroy_instance",
    async (msg) => {
      await verifyKey(msg, async (data) => {
        await multipleWppSessionHandler.destroyClient(data.key);
      });
    },
    { noAck: false }
  );

  await amqpChannel.consume(
    "send_message",
    async (msg) => {
      await verifyKey(msg, async (data) => {
        if (!data.chat_id || !data.message) return;
        await multipleWppSessionHandler.sendMessage(
          data.key,
          data.chat_id,
          data.message
        );
      });
    },
    { noAck: false }
  );

  async function performHealthCheck() {
    const usageMetric = await healthChecker();
    if (creationAvailable) {
      if (usageMetric.cpu >= 90 || usageMetric.ram >= 90) {
        await amqpChannel.cancel(creationConsumer.consumerTag);
        creationAvailable = false;
      }
    } else {
      if (usageMetric.cpu <= 80 && usageMetric.ram < 80) {
        creationConsumer = await performCreationConsumer();
        creationAvailable = true;
      }
    }
  }

  async function performCreationConsumer() {
    return await amqpChannel.consume(
      "create_instance",
      async (msg) => {
        const data = parseMessageToJson(msg);
        if (data.key) {
          await multipleWppSessionHandler.createClient(data.key);
        }
      },
      { noAck: true }
    );
  }

  async function verifyKey(message, isValidCallback = async (data) => {}) {
    const data = parseMessageToJson(message);

    if (data.key) {
      const isValid = multipleWppSessionHandler.hasInstance(data.key);
      if (isValid) {
        await amqpChannel.ack(message);
        await isValidCallback(data);
        return;
      }
    }
    await amqpChannel.nack(message);
  }

  function parseMessageToJson(message) {
    if (!message) return {};
    try {
      return JSON.parse(message.content.toString());
    } catch (error) {
      return {};
    }
  }

  async function assertQueueList(list = []) {
    for (const queue of list) {
      await amqpChannel.assertQueue(queue, { durable: true });
    }
  }
})();
