
/**
 * @fileOverview Decoy Relay Server for Infinite (WEB Proxy).
 * Returns a fake blog on GET, handles encrypted WebSocket on authenticated endpoint.
 * Requires: fastify, @fastify/websocket, crypto
 */

const fastify = require('fastify')({ logger: true });
const path = require('path');
const crypto = require('crypto');

const PROXY_SECRET = 'infinite_white_proxy_2024';

fastify.register(require('@fastify/websocket'));

// DECOY: Root returns a legitimate looking landing page
fastify.get('/', async (request, reply) => {
  reply.type('text/html').send(`
    <html>
      <head><title>Decoy Blog - Personal Journey</title></head>
      <body style="font-family: sans-serif; padding: 50px;">
        <h1>Welcome to my Personal Blog</h1>
        <p>I post updates about gardening and low-level C programming.</p>
        <hr/>
        <article>
          <h2>How to prune roses in early Spring</h2>
          <p>Pruning roses is an essential part of rose care...</p>
        </article>
      </body>
    </html>
  `);
});

// PROXY TUNNEL: Authenticated via HMAC
fastify.get('/tunnel', { websocket: true }, (connection, req) => {
  const { auth, mask } = req.query;

  // Verify HMAC Token
  const timestamp = Math.floor(Date.now() / 10000).toString();
  const hmac = crypto.createHmac('sha256', PROXY_SECRET);
  hmac.update(timestamp);
  const expectedToken = hmac.digest('base64');

  if (!auth || auth !== expectedToken) {
    console.log("Invalid HMAC Token. Rejecting connection.");
    connection.socket.close(4001, 'Unauthorized');
    return;
  }

  console.log(`Accepted authenticated proxy connection masked as ${mask}`);

  connection.socket.on('message', async (message) => {
    // 1. Message arrives as AES-256-GCM encrypted base64
    // 2. Here we would decrypt and relay to internal Firestore/API
    // 3. For this PoC, we just echo the encrypted packet back
    console.log("Relaying encrypted packet...");
    connection.socket.send(message); 
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Relay server active on port 3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
