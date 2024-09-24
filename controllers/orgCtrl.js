const Organization = require('../models/Organization');
const User = require('../models/User');

exports.create = async (req, res) => {
  const {
    name,
    assistant_name,
    temperature,
    model = 'gpt-3.5-turbo',
    api,
    prompt,
    greeting,
  } = req.body;

  if (!name) {
    return res.status(404).json({message: 'Name is required'});
  }

  try {
    const org = await Organization.findOne({name});
    if (org) return res.json({message: 'Name already taken.'});

    const org_data = new Organization({
      name,
      assistant_name,
      temperature,
      model,
      api,
      prompt,
    });

    const new_org = await org_data.save();
    const item = await User.findByIdAndUpdate(
      req.user._id,
      {$set: {organization: new_org._id}},
      {new: true}
    );

    if (!item) {
      return res.status(404).json({message: 'User not found'});
    }

    res.json({message: `Organization created`});
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.createUser = async (req, res) => {
  const {org_id, email, first_name, last_name, password, role, status} =
    req.body;

  try {
    const user_data = new User({
      organization: org_id,
      first_name,
      last_name,
      email,
      password,
      role,
      status,
    });

    await user_data.save();
    res.json({message: `User created`});
  } catch (error) {
    res.json({message: 'Internal server error', error});
  }
};

exports.findUsers = async (req, res) => {
  const {org_id} = req.body;

  try {
    const users = await User.find({organization: org_id}).select([
      '-password',
      '-organization',
    ]);
    res.status(200).json({users});
  } catch (error) {
    res.json({message: 'Internal server error', error});
  }
};

exports.editUser = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const {first_name, last_name, role, status} = req.body;
    const item = await User.findByIdAndUpdate(
      user_id,
      {$set: {first_name, last_name, role, status}},
      {new: true}
    );

    if (!item) {
      return res.status(404).json({message: 'User not found'});
    }

    res.status(200).json({message: 'User updated'});
  } catch (error) {
    res.status(500).json({message: 'Internal Server Error', error});
  }
};

exports.deleteUser = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    const user = await User.findByIdAndDelete(user_id);
    if (!user) return res.status(404).json({message: 'User not found'});

    res.status(201).json({message: 'User deleted'});
  } catch (error) {
    res.status(500).json({message: 'Internal server error', error});
  }
};

exports.getOrg = async (req, res) => {
  try {
    const id = req?.user?.organization;
    const org = await Organization.findById(id);
    if (!org) {
      return res.status(404).json({message: 'Organization not found'});
    }
    return res.json({org});
  } catch (error) {
    res.status(500).json({error});
  }
};

exports.getOrgDetailByPublicApi = async (req, res) => {
  try {
    const org_id = req.params.org_id;
    const org = await Organization.findById(org_id);
    if (!org) {
      return res.status(404).json({message: 'Organization not found'});
    }
    return res.json({org});
  } catch (error) {
    res.status(500).json({error});
  }
};

exports.editOrg = async (req, res) => {
  try {
    const {
      name,
      assistant_name,
      temperature,
      selectedModel,
      apiKey,
      prompt,
      greeting,
      workflowFlag,
      mockData,
      additionalPrompt,
    } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req?.user?.organization,
      {
        name,
        assistant_name,
        temperature,
        model: selectedModel,
        api: apiKey,
        greeting,
        prompt,
        workflow_engine_enabled: workflowFlag,
        mock_data: mockData,
        ...additionalPrompt,
      },
      {new: true}
    );
    return res.json(org);
  } catch (error) {
    res.status(500).json({error});
  }
};

exports.getGreeting_botName = async (req, res) => {
  try {
    const id = req.query.org_id;
    const org = await Organization.findById(id);
    if (org) {
      return res.json({
        greeting: org.greeting,
        assistant_name: org.assistant_name,
        org_id: id,
      });
    }
    return res.status(404).json({message: 'Organization not found'});
  } catch (error) {
    res.status(500).json({error});
  }
};
