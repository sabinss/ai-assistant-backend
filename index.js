require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./routes/swagger');
const port = process.env.PORT || 8000;
const cors = require('cors');
const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
const db = require('./helper/db');
// const seedCustomerFeature = require('./seeders/seedCustomerFeature');

app.use(express.json());

const corsOptions = {
  origin: '*',
  credentials: true,
};
// seedCustomerFeature();
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: false}));

// app.options('*', cors(corsOptions)); // Preflight request support

http: db.connect();
app.get('/health-check', async (req, res) => {
  const check = await db.connect();
  if (!check) {
    res.status(500).send('Not OK');
  }
  res.status(200).send('Instwise API running..');
});
//seeding line is this
//require("./seeders/allseeder.js")()

require('./service/userAuth');
require('./models');
require('./routes')(app);

app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
