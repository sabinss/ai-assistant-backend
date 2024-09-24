const User = require('../models/User.js');
const bcrypt = require('bcrypt');
const Feedback = require('../models/Feedback.js');
const {faker} = require('@faker-js/faker');
const Role = require('../models/Role.js');
const Status = require('../models/Status.js');
const Source = require('../models/Source.js');
const SessionApi = require('../models/SessionApi.js');
const Organization = require('../models/Organization.js');
const seedOrganization = async () => {
  const newOrg = new Organization({
    name: 'Example Organization',
    assistant_name: 'Org Assistant',
    temperature: 0,
    model: 'Example Model',
    api: 'Example API',
    prompt: 'Example Prompt',
  });
  await newOrg.save();
  console.log('seedeed one organization');
};
// seedOrganization();
const seedRole = async () => {
  const items = await Role.countDocuments({});
  if (items > 0) return;
  try {
    const rolesToCreate = [{name: 'admin'}, {name: 'reviewer'}, {name: 'user'}];
    const roles = await Role.insertMany(rolesToCreate);
    console.log('Seeded roles');
    return roles.map((role) => role._id);
  } catch (error) {
    console.error('Error seeding roles to the database:', error);
  }
};

const seedSource = async () => {
  const items = await Source.countDocuments({});
  if (items > 0) return;
  try {
    //gernerate source object with three columns organization:string, name:string, status: new,processed or removed
    const sourcesToCreate = [
      {
        organization: 'Example Organization2',
        name: 'Example Source',
        status: 'new',
      },
      {
        organization: 'Example Organization',
        name: 'Example Source2',
        status: 'removed',
      },
      {
        organization: 'Example Organization3',
        name: 'Example Source3',
        status: 'new',
      },
      {
        organization: 'Example Organization4',
        name: 'Example Sourc4e',
        status: 'processed',
      },
    ];
    const sources = await Source.insertMany(sourcesToCreate);
    console.log('Seeded sources');
  } catch (error) {
    console.error('Error seeding sources to the database:', error);
  }
};
seedSource();
const seedStatus = async () => {
  const items = await Status.countDocuments({});
  if (items > 0) return;
  try {
    const statusToCreate = [
      {name: 'active'},
      {name: 'pending'},
      {name: 'deleted'},
    ];
    const statuses = await Status.insertMany(statusToCreate);
    console.log('Seeded status');
    return statuses.map((status) => status._id);
  } catch (error) {
    console.error('Error seeding status to the database:', error);
  }
};

const createRandomFeedback = (statusIds) => {
  const randomStatusId =
    statusIds[Math.floor(Math.random() * statusIds.length)];
  return {
    organization: '65f031ef989dd343c3d529b6', // Replace with your organization ID
    question: faker.lorem.sentence(),
    feedback: ['liked', 'disliked'][Math.floor(Math.random() * 2)],
    original_answer: faker.lorem.paragraph(),
    modified_answer: '',
    frequency: faker.number.int({min: 1, max: 10}),
    status: ['new', 'updated', 'removed'][Math.floor(Math.random() * 3)],
  };
};

const createRandomUser = (roleIds, statusIds) => {
  const randomRoleId = roleIds[Math.floor(Math.random() * roleIds.length)];
  const randomStatusId =
    statusIds[Math.floor(Math.random() * statusIds.length)];
  return {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    email: faker.internet.email(),
    password: bcrypt.hashSync('password', 10), // Using a fixed password for simplicity
    role: randomRoleId,
    status: randomStatusId,
  };
};

const seedUsers = async (roleIds, statusIds) => {
  try {
    const usersToCreate = Array.from({length: 30}, () =>
      createRandomUser(roleIds, statusIds)
    );
    await User.insertMany(usersToCreate);
    console.log('Successfully seeded users to the database.');
  } catch (error) {
    console.error('Error seeding users to the database:', error);
  }
};

const seedData = async () => {
  try {
    const roleIds = await seedRole();
    const statusIds = await seedStatus();

    const feedbackCount = await Feedback.countDocuments({});
    if (feedbackCount === 0) {
      const feedbackToCreate = Array.from({length: 30}, () =>
        createRandomFeedback(statusIds)
      );
      await Feedback.insertMany(feedbackToCreate);
      console.log('Successfully seeded feedback to the database.');
    } else {
      console.log('Feedback already exists. Skipping feedback seeding.');
    }

    const userCount = await User.countDocuments({});
    if (userCount === 0) {
      await seedUsers(roleIds, statusIds);
    } else {
      console.log('Users already exist. Skipping user seeding.');
    }
  } catch (error) {
    console.error('Error seeding data to the database:', error);
  }
};
const seedSession = async () => {
  await SessionApi.deleteMany({});
  const sessionToCreate = {
    name: 'Session 1',
    // key is random mix of numbers and letters
    key: Array(16)
      .fill()
      .map(() => Math.random().toString(36)[2])
      .join(''),
  };

  try {
    const data = await SessionApi.create(sessionToCreate);
    console.log('Successfully seeded session data', data);
  } catch (error) {
    console.error('Error seeding session data:', error);
  }
};

//if there are no sessionsApi in database then seed

module.exports = seedSession;
