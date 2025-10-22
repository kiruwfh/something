const express = require('express');
const crypto = require('crypto');

const app = express();

app.get('/hash', (req, res) => {
  const hash = crypto.createHash('md5').update('value').digest('hex');
  res.send(hash);
});

app.listen(3000);
