const AGENT_SETUP_DATA = require('../constants/agent-setup-sample-data');
const Customer = require('../models/Customer');
const GoogleUser = require('../models/GoogleUser');
const Organization = require('../models/Organization');
const TaskAgentModel = require('../models/TaskAgentModel');
const User = require('../models/User');
const axios = require('axios');
const mongoose = require('mongoose');
const AgentModel = require('../models/AgentModel');
const AgentTask = require('../models/AgentTask');
const AgentTaskStatusModel = require('../models/AgentTaskStatusModel');
const OrganizationPrompt = require('../models/OrganizationPrompt');
const fs = require('fs');
const FormData = require('form-data');
const {
  organizationPromptDefaultData,
} = require('../seeders/saveOrganizationPrompt');
const OrganizationToken = require('../models/OrganizationToken');
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
    return res.status(404).json({ message: 'Name is required' });
  }

  try {
    const org = await Organization.findOne({ name });
    if (org) return res.json({ message: 'Name already taken.' });

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
      { $set: { organization: new_org._id } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `Organization created` });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.createUser = async (req, res) => {
  const { org_id, email, first_name, last_name, password, role, status } =
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
    res.json({ message: `User created` });
  } catch (error) {
    res.json({ message: 'Internal server error', error });
  }
};

exports.findUsers = async (req, res) => {
  const { org_id } = req.body;

  try {
    const users = await User.find({ organization: org_id }).select([
      '-password',
      '-organization',
    ]);
    res.status(200).json({ users });
  } catch (error) {
    res.json({ message: 'Internal server error', error });
  }
};

exports.editUser = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const { first_name, last_name, role, status } = req.body;
    const item = await User.findByIdAndUpdate(
      user_id,
      { $set: { first_name, last_name, role, status } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.deleteUser = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    const user = await User.findByIdAndDelete(user_id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(201).json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.updateOrgSettings = async (req, res) => {
  try {
    const org = await Organization.findById(id);
    if (!id) res.status(500).json({ message: 'Organization is is required' });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    return res.json({ org: orgResponsePayload });
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getOrg = async (req, res) => {
  try {
    let id = req?.user?.organization;
    if (req?.user?.organization) {
      id = req?.user?.organization;
    } else {
      id = req.query.organization;
    }
    // 66158fe71bfe10b58cb23eea
    let organizationTokenRecord = null;
    let organizationEmail = null;

    if (req.user.organization) {
      const user = await User.findOne({
        organization: id,
      });
      if (user) {
        organizationEmail = user.email;
      }
    }
    if (req.user?.email || organizationEmail) {
      const email = req.user?.email || organizationEmail;
      organizationTokenRecord = await OrganizationToken.findOne({
        email,
      });
    }
    const org = await Organization.findById(id);
    if (!id) res.status(500).json({ message: 'Organization is is required' });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    const {
      _id,
      name,
      greeting,
      primary_assistant_prompt: primary_prompt,
      solution_prompt,
      recommendation_prompt: followup_prompt,
      prompt: internal_solution_prompt,
      schema_prompt,
      abstract_refinement_prompt,
      nltosql_prompt,
      email_outreach,
      email_reply_prompt,
      customer_outreach_prompt,
      workflow_engine_enabled,
      outreach_email_generation_prompt,
      outreach_customer_list_generation_prompt,
      temperature,
      api,
      model,
      database_name,
      redshit_work_space,
      redshift_db,
      assistant_name,
    } = org;
    const orgResponsePayload = {
      _id,
      name,
      greeting,
      primary_prompt,
      solution_prompt,
      followup_prompt,
      internal_solution_prompt,
      schema_prompt,
      abstract_refinement_prompt,
      nltosql_prompt,
      email_outreach,
      email_reply_prompt,
      customer_outreach_prompt,
      workflow_engine_enabled,
      outreach_email_generation_prompt,
      outreach_customer_list_generation_prompt,
      temperature,
      api,
      model,
      database_name,
      redshit_work_space,
      redshift_db,
      email: organizationTokenRecord.email,
      organizationToken: organizationTokenRecord.token,
      assistant_name,
    };
    return res.json({ org: orgResponsePayload });
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getOrgDetailByPublicApi = async (req, res) => {
  try {
    const org_id = req.params.org_id;
    const org = await Organization.findById(org_id);
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    return res.json({ org });
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.editOrg = async (req, res) => {
  try {
    // update request assistant name of organization name
    if (req.body?.singleUpdate) {
      const { name = null, assistant_name = null } = req.body;
      let payload = name ? { name } : { assistant_name };
      const org = await Organization.findByIdAndUpdate(
        req?.user?.organization,
        payload,
        { new: true }
      );
      return res.json(org);
    }

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
      configuration,
      additionalPrompt,
      orgDbSetting,
    } = req.body;

    let payload = null;
    if (configuration == 'setting') {
      payload = {
        model: selectedModel,
        temperature,
        api: apiKey,
        ...orgDbSetting,
      };
    } else if (configuration == 'configuration') {
      payload = {
        ...additionalPrompt,
      };
    } else {
      const updatePrompt = {
        ...additionalPrompt,
        prompt: additionalPrompt.internal_solution_prompt,
      };
      payload = {
        name,
        assistant_name,
        temperature,
        model: selectedModel,
        api: apiKey,
        greeting,
        prompt,
        workflow_engine_enabled: workflowFlag,
        mock_data: mockData,
        ...updatePrompt,
      };
    }
    const org = await Organization.findByIdAndUpdate(
      req?.user?.organization,
      payload,
      { new: true }
    );
    return res.json(org);
  } catch (error) {
    res.status(500).json({ error });
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
    return res.status(404).json({ message: 'Organization not found' });
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getCustomerList = async (req, res) => {
  const org_id = req.params.org_id;
  try {
    const orgCustomers = await Customer.find({ organization: org_id });
    if (!orgCustomers)
      return res.status(404).json({ message: 'Customer not found' });

    res.status(200).json({ organization: org_id, customers: orgCustomers });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};
exports.createOrganizationPrompt = async (req, res) => {
  try {
    const { organizationPrompts = [], deletePromptIds = [] } = req.body;
    if (organizationPrompts?.length == 0) {
      res.status(400).json({ message: 'Payload is empty', success: false });
    }
    const isDirtyRecords = organizationPrompts.filter((x) => x.isDirty);

    console.log('isDirtyRecords', isDirtyRecords);

    if (isDirtyRecords.length == 0 && deletePromptIds?.length == 0) {
      res.status(200).json({ message: 'Updated successfully', success: true });
      return;
    }

    if (deletePromptIds?.length > 0) {
      for (const orgPrompt of deletePromptIds) {
        const { orgPromptId, promptId } = orgPrompt;

        await OrganizationPrompt.findByIdAndUpdate(
          orgPromptId, // ID of the OrganizationPrompt document
          { $pull: { prompts: { _id: promptId } } }, // Remove the prompt with the specified text
          { new: true } // Return the updated document
        );
      }
    }

    if (isDirtyRecords?.length > 0) {
      for (const orgPrompt of isDirtyRecords) {
        const { _id: orgPromptId, prompts } = orgPrompt;
        for (const prompt of prompts) {
          if (prompt._id.startsWith('temp-')) {
            // This is a new prompt — add it
            await OrganizationPrompt.findByIdAndUpdate(
              orgPromptId,
              {
                $push: {
                  prompts: { text: prompt.text }, // Only include fields needed
                },
              },
              { new: true }
            );
          } else {
            // await OrganizationPrompt.updateOne(
            //   { _id: orgPromptId, 'prompts._id': prompt._id },
            //   { $set: { 'prompts.$.text': prompt.text } }
            // );
            const id = new mongoose.Types.ObjectId(prompt._id);

            await OrganizationPrompt.updateOne(
              {
                _id: orgPromptId,
                'prompts._id': id,
              },
              { $set: { 'prompts.$.text': prompt.text } }
            );
          }
        }
        res.status(200).json({ message: 'Updated successfully' });
        return;
      }
    }
    res.status(200).json({ message: 'Updated successfully', success: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Failed to save organization prompts', error });
  }
};

exports.updateOrganizationPromptCategory = async (req, res) => {
  try {
    const { orgPromptId, category } = req.body;

    if (!orgPromptId || !category) {
      res
        .status(400)
        .json({ message: 'OrgPromptId | category is missing', error });
    }

    await OrganizationPrompt.updateOne(
      { _id: orgPromptId },
      { $set: { category: category } }
    );
    res.status(200).json({ message: 'Updated successfully', success: true });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update organization prompt category', err });
  }
};
exports.getOrganizationPrompt = async (req, res) => {
  try {
    if (!req?.user?.organization) {
      res.status(500).json({ message: 'Organization is required', err });
    }
    let organizationPrompts = null;
    const organization = req?.user?.organization;
    organizationPrompts = await OrganizationPrompt.find({
      organization: organization,
    }).lean(); // If you need to populate organization details
    if (!organizationPrompts || organizationPrompts.length === 0) {
      const insertedData = await OrganizationPrompt.insertMany(
        organizationPromptDefaultData.map((category) => ({
          ...category,
          organization: organization,
        }))
      );
      organizationPrompts = await OrganizationPrompt.find({
        organization: organization,
      }).lean();
    }
    res.status(200).json({ organizationPrompts });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Failed to fetch organization prompts', error });
  }
};

// exports.getConnectedGmailsWithOrg = async (req, res) => {
//   try {
//     const isVerifiedFromExternalCall = req?.externalApiCall && req.organization;
//     if (isVerifiedFromExternalCall) {
//       const { gmail = null } = req.query;
//       const orgDetail = await Organization.findById(
//         req.organization._id,
//         'orgGoogleCredential'
//       ).lean();

//       const orgGoogleUsers = await GoogleUser.find({
//         organization: req.organization._id,
//       }).lean();

//       let response = orgGoogleUsers.map((x) => ({
//         ...x,
//         orgGoogleCredential: orgDetail.orgGoogleCredential,
//       }));

//       if (gmail) {
//         response = response.filter((x) => x.email == gmail);
//       }
//       res.status(200).json({
//         data: response,
//       });
//     }
//   } catch (err) {
//     res.status(500).json({ message: 'Internal server error', err });
//   }
// };

exports.getConnectedGmailsWithOrg = async (req, res) => {
  try {
    const isVerifiedFromExternalCall = req?.externalApiCall && req.organization;
    if (isVerifiedFromExternalCall) {
      // this is logged in user
      const user_email = req.user.email;
      const orgDetail = await Organization.findById(
        req.organization._id,
        'orgGoogleCredential'
      ).lean();
      const connectedGmailUsers = await GoogleUser.find({
        organization: req.organization._id,
      }).lean();

      const responsePayload = {
        user_email,
        orgGoogleCredential: orgDetail.orgGoogleCredential,
        connectedEmails: connectedGmailUsers,
      };
      res.status(200).json({
        data: responsePayload,
      });
    } else {
      res.status(500).json({ message: 'Internal server error', err });
    }
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', err });
  }
};

exports.callTaskAgentPythonApi = async (req, res) => {
  try {
    const { task_name, org_id } = req.body;
    if (!task_name || !org_id) {
      res
        .status(400)
        .json({ success: false, message: 'TaskName | OrgId are required' });
    }
    const pythonServerUri = `${process.env.AI_AGENT_SERVER_URI}/task-agent?task_name=${task_name}&org_id=${org_id}`;
    const response = await axios.post(pythonServerUri);
    return res.status(200).json({
      data: response?.data,
    });
  } catch (err) {
    res.status(500).json({ err });
  }
};

exports.getOrgAgentInstructions = async (req, res) => {
  try {
    const { organization } = req.user;
    // const { agent_name } = req.query;
    // Step 1: Fetch all agents for the given organization
    let agents = await AgentModel.find({ organization });

    // if (agent_name) {
    //   agents = agents.filter(
    //     (x) => x.name.toLowerCase() == agent_name.toLowerCase()
    //   );
    // }

    // Step 2: Fetch all AgentInstructions for the agents in parallel
    const agentInstructions = await AgentTask.find({
      agent: { $in: agents.map((agent) => agent._id) }, // Fetch instructions for all agents in one query
    });

    // Step 3: Create a mapping of agent ID to agent instructions for easy lookup
    const instructionsMap = agentInstructions.reduce((map, instruction) => {
      if (!map[instruction.agent]) {
        map[instruction.agent] = [];
      }
      map[instruction.agent].push(instruction);
      return map;
    }, {});

    // Step 4: Merge agent data with their instructions
    const agentsWithInstructions = agents.map((agent) => {
      return {
        ...agent.toObject(), // Convert Mongoose document to plain JavaScript object
        tasks: instructionsMap[agent._id] || [], // Attach instructions if they exist
      };
    });

    // Step 5: Return the response with agents and their instructions
    return res.status(200).json({
      data: agentsWithInstructions,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateOrgAgentInstructions = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Begin a transaction to ensure consistency
  try {
    console.log('req.body', req.body);

    const { _id, tasks, ...agentData } = req.body;

    // Check if the organization is present
    if (!req.user.organization) {
      return res.status(400).json({ message: 'Organization id required' });
    }

    // Find the agent by id and update its fields
    const agent = await AgentModel.findOneAndUpdate(
      { _id: _id, organization: req.user.organization },
      { ...agentData },
      { new: true, session } // Return the updated document and use the session for the transaction
    );

    // If agent not found, return an error
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    let updatedAgentInstructions = [];
    if (tasks && tasks.length > 0) {
      // Delete the existing instructions for this agent
      await AgentTask.deleteMany({ agent: agent._id }, { session });

      // Insert new instructions
      updatedAgentInstructions = await AgentTask.insertMany(
        tasks.map((inst) => ({
          agent: agent._id,
          name: inst.name,
          tools: inst.tools,
          instruction: inst.instruction,
        })),
        { session }
      );
    }

    await session.commitTransaction(); // Commit transaction
    session.endSession();

    console.log('Agent and Instructions updated successfully!');

    return res.status(200).json({
      message: 'Agent and Instructions updated successfully!',
      agent,
      instructions: updatedAgentInstructions,
      success: true,
    });
  } catch (err) {
    await session.abortTransaction(); // Rollback transaction in case of error
    session.endSession();
    console.error('Error updating agent and instructions:', err);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
};

exports.getAgentTaskStatus = async (req, res) => {
  try {
    const { organization, customer } = req.query; // Expecting orgId, agentId, and customerId as query parameters
    const { agentId } = req.params;
    if (!organization || !agentId || !customer) {
      return res.status(400).json({
        message: 'Missing required parameters: orgId, agentId, customerId',
      });
    }
    const tasks = await AgentTaskStatusModel.find({
      organization,
      agent: agentId,
      customer,
    })
      .populate('organization', 'name _id')
      .populate('agent')
      .populate('agentTask')
      .populate('customer', 'name email _id');

    if (tasks.length === 0) {
      return res
        .status(404)
        .json({ message: 'No tasks found for this agent and customer' });
    }

    return res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server Error' });
  }
};

exports.storeAgentTaskExecuteStatus = async (req, res) => {
  try {
    const { agentId, taskId } = req.params;
    const { organizationId, customerId, status } = req.body;

    // Validate required fields
    if (!agentId || !taskId || !organizationId || !customerId) {
      return res
        .status(400)
        .json({ error: 'Bad Request. Missing required fields.' });
    }

    // Define valid statuses (in lowercase)
    const validStatuses = ['open', 'in progress', 'done'];

    // Create a new AgentTaskStatus entry
    const newTaskStatus = new AgentTaskStatusModel({
      agent: agentId,
      agentTask: taskId,
      organization: organizationId,
      customer: customerId,
      status: status,
    });

    // Save to database
    await newTaskStatus.save();

    res.status(201).json({
      message: 'Agent task status stored successfully',
      data: newTaskStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server Error' });
  }
};

exports.getAgentTasksStatus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { organizationId, customerId } = req.query;

    // Validate required fields
    if (!agentId || !organizationId || !customerId) {
      return res.status(400).json({
        error:
          'Bad Request. Missing required parameters: organizationId, agentId, customerId',
      });
    }

    // Find all task statuses matching the provided filters
    const tasks = await AgentTaskStatusModel.find({
      agent: agentId,
      organization: organizationId,
      customer: customerId,
    })
      .populate('agentTask', 'taskName') // Populating task details
      .populate('customer', 'name') // Populating customer details
      .populate('organization', 'name') // Populating organization details
      .lean();

    if (!tasks.length) {
      return res
        .status(404)
        .json({ message: 'No tasks found for the given criteria' });
    }

    res.status(200).json({ tasks });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server Error' });
  }
};

exports.createOrgAgentInstructions = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Begin a transaction to ensure consistency
  try {
    const { id, tasks, ...agentData } = req.body;
    if (!req.user.organization) {
      res.status(400).json({ message: 'Organization id required' });
    }
    const agent = new AgentModel({
      ...agentData,
      organization: req.user.organization,
    });

    await agent.save({ session });

    let newAgentInstructions = [];
    if (tasks.length > 0) {
      // 2️⃣ Insert Multiple Agent Instructions
      newAgentInstructions = await AgentTask.insertMany(
        tasks.map((inst) => ({
          agent: agent._id,
          name: inst.name,
          tools: inst.tools,
          instruction: inst.instruction,
        })),
        { session }
      );
    }
    await session.commitTransaction(); // Commit transaction
    session.endSession();

    console.log('Agent and Instructions inserted successfully!');

    return res.status(200).json({
      message: 'New Agent and Instructions created successfully!',
      agent,
      instructions: newAgentInstructions,
      success: true,
    });
  } catch (err) {
    res.status(500).json({ err });
  }
};

exports.getCustomerDetail = async (req, res) => {
  const customerName = req.query.customer_name;
  try {
    if (!customerName)
      return res.status(404).json({ message: 'Please provide customer name' });
    const customer = await Customer.findOne({
      name: { $regex: customerName, $options: 'i' },
    });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const {
      _id,
      name,
      email,
      crm_cust_id,
      csm_cust_id,
      accounting_cust_id,
      help_desk_cust_id,
    } = customer;
    res.status(200).json({
      data: {
        _id,
        name,
        email,
        crm_cust_id: crm_cust_id ?? null,
        csm_cust_id: csm_cust_id ?? null,
        accounting_cust_id: accounting_cust_id ?? null,
        help_desk_cust_id: help_desk_cust_id ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.saveOrgSupportWorkflow = async (req, res) => {
  try {
    const { org_id, workflow_engine_enabled } = req.body;
    if (!org_id) {
      return res.status(400).json({ message: 'Bad request' });
    }
    const updatedOrg = await Organization.findByIdAndUpdate(
      org_id,
      {
        workflow_engine_enabled: workflow_engine_enabled
          ? workflow_engine_enabled
          : false,
      },
      { new: true, runValidators: true }
    );
    if (!updatedOrg) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    res.status(200).json({
      message: 'Organization updated successfully.',
      organization: updatedOrg,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.getOrgTaskAgents = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { name } = req.query;
    if (!org_id) {
      return res.status(400).json({ message: 'Bad request' });
    }
    const organization = await Organization.findById(org_id).select('name');
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    let filter = { organization: org_id };
    if (name) {
      filter.name = { $regex: new RegExp(name, 'i') };
    }
    const taskAgents = await TaskAgentModel.find(filter);
    res.status(200).json({
      organization, // Include organization details in the response
      taskAgents,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.updateOrgTaskAgents = async (req, res) => {
  try {
    const { org_id, taskAgentId } = req.params;
    if (!org_id) {
      return res.status(400).json({ message: 'Bad request' });
    }
    const updateData = req.body;
    const updatedTaskAgent = await TaskAgentModel.findByIdAndUpdate(
      taskAgentId,
      updateData,
      { new: true }
    );
    if (!updatedTaskAgent) {
      return res.status(404).json({ message: 'TaskAgent not found' });
    }
    res.status(200).json(updatedTaskAgent);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.getOrganizationAgentSetup = async (req, res) => {
  try {
    if (req.externalApiCall && req.organization) {
      res.status(200).json(AGENT_SETUP_DATA);
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.createOrgTaskAgents = async (req, res) => {
  try {
    const { org_id } = req.params;
    if (!org_id) {
      return res.status(400).json({ message: 'Bad request' });
    }
    const {
      name,
      action,
      objective,
      who,
      trigger,
      output,
      tools,
      active,
      frequency,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    // Validate Organization
    const organization = await Organization.findById(org_id);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    // Create a new TaskAgent.
    const newTaskAgent = new TaskAgentModel({
      name,
      action,
      objective,
      who,
      trigger,
      output,
      tools,
      active:
        typeof active === 'boolean' ? active : active.toLowerCase() === 'Y',
      frequency,
      organization: org_id,
    });
    await newTaskAgent.save();
    res.status(201).json(newTaskAgent);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.deleteSourceFile = async (req, res) => {
  try {
    const { company_id, file_names } = req.query;
    const headers = {
      accept: 'application/json',
      'X-API-KEY': process.env.NEXT_PUBLIC_OPEN_API_KEY_FOR_CHAT,
    };
    // https://chat-backend.instwise.app/api/assistant/delete-pdfs?company_id=66158fe71bfe10b58cb23eea&file_names=5-mb-example-file.pdf
    const url = `${process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT}/assistant/delete-pdfs?company_id=${company_id}&file_names=${file_names}}`;

    console.log('delete route hit');
    const response = await axios.delete(url, { headers });
    res.status(201).json(response.data);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.uploadOrganizationSourceUpload = async (req, res) => {
  try {
    const url = `${process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT}/assistant/upload-pdfs`;
    const formData = new FormData();
    const files = req.files;
    if (!files || files.length == 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    for (const file of files) {
      formData.append(
        'files',
        fs.createReadStream(file.path),
        file.originalname
      );
    }
    const headers = {
      ...formData.getHeaders(), // Required to set correct `Content-Type` with boundary
      accept: 'application/json',
      'X-API-KEY': process.env.NEXT_PUBLIC_OPEN_API_KEY_FOR_CHAT,
      'Content-Type': 'multipart/form-data',
    };
    const params = {
      company_id: req.user.organization,
    };
    const response = await axios.post(url, formData, { headers, params });
    res.status(201).json(response.data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload file', err });
  }
};

exports.fetchSourceFileList = async (req, res) => {
  try {
    const headers = {
      accept: 'application/json',
      'X-API-KEY': process.env.NEXT_PUBLIC_OPEN_API_KEY_FOR_CHAT,
    };
    // companyId = organizationId
    const params = req.query;
    const url = `${
      process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT
    }/assistant/get-pdfs-list?company_id=${params.company_id}&page=${
      params.page
    }&search=${params.search ?? null}&sortField=${
      params.sortField ?? null
    }&sortDirection=${params.sortDirection ?? null}&limit=${params.limit}`;
    console.log('url', url);
    const response = await axios.get(url, { headers });
    res.status(200).json(response.data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetc files', err });
  }
};
