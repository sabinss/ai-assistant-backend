const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const options = {

    definition: {

        openapi: '3.0.0',

        info: {

            title: 'Agile Move',

            version: '1.0.0',

        },

        components: {

            securitySchemes: {

                ApiKeyAuth: {  // This name is arbitrary and can be anything

                    type: 'apiKey',

                    in: 'header',  // The API key is passed in the header

                    name: 'x-api-key-local',  // Name of the header

                },

            },

        },

    },

    apis: ['./routes/*.js'],

};

const openapiSpecification = swaggerJsdoc(options);

// Assuming app is your Express app

module.exports = (app) => {

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

};