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
// const seedPromptInAllOrganization = require('./seeders/promptSeed');
// seedPromptInAllOrganization();

app.use(express.json());
// const allowedOrigins = [
//   'https://ai-assistant-frontend-16miex02f-sabins-projects-06b468fc.vercel.app/',
//   'http://18.191.201.61',
// ];

const corsOptions = {
  origin: '*',
  credentials: true,
};
// Set up CORS options
// const corsOptions = {
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true, // Allow cookies to be sent with requests
// };

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
