const os = require("os");
const osUtils = require("os-utils");

async function getSystemInfo() {
  const cpuUsage = await new Promise((r) =>
    osUtils.cpuUsage((usage) => r(usage * 100))
  );
  
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;

  const formattedMemoryUsage = memoryUsage.toFixed(2);
 
  return {
    cpu: cpuUsage,
    ram: formattedMemoryUsage,
  };
}

module.exports = getSystemInfo;
