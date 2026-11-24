import { getRedis } from './src/config/redis';

async function testRedis() {
  console.log('Connecting to Redis Cloud...');
  const redis = getRedis();

  const ping = await redis.ping();
  console.log('✅ Redis Ping response:', ping);

  await redis.set('outbox:test', 'hello from Outbox');
  const value = await redis.get('outbox:test');
  console.log('✅ Redis Set/Get test successful. Value:', value);

  await redis.del('outbox:test');
  console.log('✅ Redis Cloud connection is fully operational!');

  await redis.quit();
}

testRedis().catch(console.error);
