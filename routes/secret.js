const Role = require("../models/Role.js");
const GptModel = require("../models/GptModel.js");
const Status = require("../models/Status.js");
const SessionApi = require("../models/SessionApi.js");
module.exports = (app) => {
    app.get(`/api/v1/seed`, async (req, res) => {
        await seedRoles();
        await seedGptModels();
        await seedStatus();
        await seedSessionApi(res);
    });
};



const seedRoles = async () => {
    try {
        const count = await Role.countDocuments({});
        if (count > 0) {
            console.log("Roles already seeded");
        } else {
            const roles = await Role.insertMany([
                { name: "admin" },
                { name: "reviewer" },
                { name: "user" },
            ]);
            console.log("Seeded roles");
        }
    } catch (err) {
        console.log("Error seeding roles to the database:", err);
    }
};

const seedGptModels = async () => {
    try {
        const count = await GptModel.countDocuments({});
        if (count > 0) {
            console.log("GptModels already seeded");
        } else {
            const gptModels = await GptModel.insertMany([
                { name: "gpt2-xl", description: "gpt2-xl model" },
                { name: "gpt2", description: "gpt2 model" },
                { name: "gpt3", description: "gpt3 model" },
            ]);
            console.log("Seeded gptModels");
        }
    } catch (err) {
        console.log("Error seeding gptModels to the database:", err);
    }
};

const seedStatus = async () => {
    try {
        const count = await Status.countDocuments({});
        if (count > 0) {
            console.log("Status already seeded");
        } else {
            const status = await Status.insertMany([
                { name: "active" },
                { name: "pending" },
                { name: "deleted" },
            ]);
            console.log("Seeded status");
        }
    } catch (err) {
        console.log("Error seeding status to the database:", err);
    }
};

const seedSessionApi = async (res) => {
    try {
        const count = await SessionApi.countDocuments({});
        if (count > 0) {
            console.log("SessionApi already seeded");
            const session = await SessionApi.findOne();
            res.json(session);
        } else {
            const session = await SessionApi.insertMany([
                {
                    name: "Session 1",
                    key: Array(16)
                        .fill()
                        .map(() => Math.random().toString(36)[2])
                        .join(""),
                },
            ]);
            res.json(session);
        }
    } catch (err) {
        console.log("Error seeding session to the database:", err);
    }
};
