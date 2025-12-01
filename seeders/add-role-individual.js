const Role = require("../models/Role");

const addRoleIndividual = async () => {
  const role = await Role.findOne({ name: "individual" });
  if (role) {
    console.log("Role individual already exists");
    return;
  }
  const newRole = new Role({ name: "individual" });
  await newRole.save();
  console.log("Role individual created");
};

module.exports = addRoleIndividual;
