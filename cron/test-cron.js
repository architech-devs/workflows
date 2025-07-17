import handler from './resetTokens/index.js';

// For testing resetTokens/index.js
const mockReq = {
  method: 'POST',
  headers: {
    'x-auth-token': process.env.CRON_SECRET_TOKEN || 'your_secret_token'
  }
};

const mockRes = {
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(payload) {
    console.log('Response:', { status: this.statusCode, ...payload });
    return this;
  }
};

(async () => {
  console.log('🚀 Running credit reset handler as test...');
  await handler(mockReq, mockRes);
})(); 