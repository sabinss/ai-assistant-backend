const ActivityLog = require('../models/ActivityLog');

// Store activity log from Python server
exports.storeActivityLog = async (req, res) => {
  try {
    const {
      log_id,
      organization_id,
      agent_id,
      agent_name,
      start_time,
      end_time,
      status,
      note,
      user_id,
      non_interaction,
    } = req.body;

    // Validate required fields
    if (
      !log_id ||
      !organization_id ||
      !agent_id ||
      !agent_name ||
      !start_time ||
      !end_time ||
      !status ||
      !user_id ||
      !non_interaction
    ) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: [
          'log_id',
          'organization_id',
          'agent_id',
          'agent_name',
          'start_time',
          'end_time',
          'status',
          'user_id',
          'non_interaction',
        ],
      });
    }

    // Validate status enum
    if (!['Pass', 'Fail'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be either "Pass" or "Fail"',
      });
    }

    // Validate non_interaction enum
    if (!['Y', 'N'].includes(non_interaction)) {
      return res.status(400).json({
        message: 'Invalid non_interaction. Must be either "Y" or "N"',
      });
    }

    // Check if log_id already exists
    const existingLog = await ActivityLog.findOne({ log_id });
    if (existingLog) {
      return res.status(409).json({
        message: 'Log ID already exists',
        log_id: log_id,
      });
    }

    // Create new activity log
    const activityLog = new ActivityLog({
      log_id,
      organization: organization_id,
      agent_id,
      agent_name,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      status,
      note: note || null,
      user_id,
      non_interaction,
    });

    await activityLog.save();

    console.log(
      `Activity log stored successfully: ${log_id} for agent ${agent_name}`
    );

    res.status(201).json({
      message: 'Activity log stored successfully',
      data: activityLog,
      success: true,
    });
  } catch (error) {
    console.error('Error storing activity log:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// Get activity logs with filters
exports.getActivityLogs = async (req, res) => {
  try {
    const {
      organization_id,
      agent_id,
      user_id,
      status,
      non_interaction,
      start_date,
      end_date,
      page = 1,
      limit = 50,
    } = req.query;

    let filter = {};

    // Apply filters
    if (organization_id) filter.organization = organization_id;
    if (agent_id) filter.agent_id = agent_id;
    if (user_id) filter.user_id = user_id;
    if (status) filter.status = status;
    if (non_interaction) filter.non_interaction = non_interaction;

    // Date range filter
    if (start_date || end_date) {
      filter.start_time = {};
      if (start_date) filter.start_time.$gte = new Date(start_date);
      if (end_date) filter.start_time.$lte = new Date(end_date);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const activityLogs = await ActivityLog.find(filter)
      .populate('organization', 'name _id')
      .populate('agent_id', 'name _id')
      .populate('user_id', 'name email _id')
      .sort({ start_time: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(filter);

    res.status(200).json({
      data: activityLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      success: true,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// Get activity log by ID
exports.getActivityLogById = async (req, res) => {
  try {
    const { log_id } = req.params;

    const activityLog = await ActivityLog.findOne({ log_id })
      .populate('organization', 'name _id')
      .populate('agent_id', 'name _id')
      .populate('user_id', 'name email _id');

    if (!activityLog) {
      return res.status(404).json({
        message: 'Activity log not found',
        log_id: log_id,
      });
    }

    res.status(200).json({
      data: activityLog,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
