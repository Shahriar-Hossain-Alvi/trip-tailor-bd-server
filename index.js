require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;



app.get('/', (req, res) => {
  res.send('Trip Tailor Bangladesh server is running');
});

app.listen(port, () => {
  console.log(`Trip Tailor Bangladesh is running on port ${port}`);
});
