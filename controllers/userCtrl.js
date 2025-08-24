const { log } = require('console');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const Role = require('../models/Role');
const Status = require('../models/Status');
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const searchQuery = req.query.search || '';
    const sortField = req.query.sortField || 'email';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;

    const searchCondition = {
      $and: [
        { organization: req?.user?.organization }, // Uncomment this line to filter by organization
        {
          $or: [
            { email: { $regex: searchQuery, $options: 'i' } },
            { first_name: { $regex: searchQuery, $options: 'i' } },
            { last_name: { $regex: searchQuery, $options: 'i' } },
          ],
        },
      ],
    };
    const users = await User.find(searchCondition)
      .select('-password')
      .skip(startIndex)
      .limit(limit)
      .sort({ [sortField]: sortDirection })
      .populate('role') // Populate the status field
      .populate('status');

    const totalUsers = await User.countDocuments(searchCondition);
    const totalPages = Math.ceil(totalUsers / limit);
    res.status(200).json({ users, totalPages });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getUser = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    const user = await User.findById(user_id)
      .select('-password')
      .populate('role')
      .populate('status');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.update = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const {
      first_name,
      last_name,
      email,
      role,
      newPassword,
      status,
      currentPassword,
    } = req.body;
    let data;
    let user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentPassword) {
      const isCurrentPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isCurrentPassword) {
        return res.status(403).json({ message: 'Incorrect current password' });
      }
    }
    // add logic to only change new password if it is organization here.
    if (newPassword) {
      data = {
        first_name,
        last_name,
        email,
        role,
        status,
        password: bcrypt.hashSync(newPassword, 10),
      };
    } else {
      data = { first_name, last_name, email, role, status };
    }

    const item = await User.findByIdAndUpdate(
      user_id,
      { $set: data },
      {
        new: true,
      }
    );
    res.status(200).json({ message: 'User updated' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.deleteUser = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    if (user_id === req?.user?._id.toString()) {
      return res.status(201).json({ message: 'User is currently logged in' });
    }
    const user = await User.findByIdAndDelete(user_id);
    return res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

exports.addUser = async (req, res) => {
  const { first_name, last_name, email, role, status, password } = req.body;
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const checkExistUser = await User.findOne({ email: email });
  if (checkExistUser?.email) {
    res.status(201).json({ message: 'Email is already in use' });
  }
  const hashed_password = bcrypt.hashSync(password, 10);
  //set default role and status to admin and pending resp
  const activeStatus = await Status.findOne({ name: 'active' });
  const adminRole = await Role.findOne({ name: 'admin' });

  try {
    const user = await User.create({
      first_name,
      last_name,
      email,
      organization: req?.user?.organization,
      role: role ? role : adminRole,
      status: activeStatus,
      password: hashed_password,
    });

    res.status(200).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const user_id = req.user._id;

    const {
      first_name,
      last_name,
      email,
      newPassword,
      status,
      currentPassword,
    } = req.body;
    let data;
    let user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentPassword) {
      const isCurrentPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isCurrentPassword) {
        return res.status(403).json({ message: 'Incorrect current password' });
      }
    }
    // add logic to only change new password if it is organization here.
    if (newPassword) {
      data = {
        first_name,
        last_name,
        email,
        status,
        password: bcrypt.hashSync(newPassword, 10),
      };
    } else {
      data = { first_name, last_name, email, status };
    }

    const item = await User.findByIdAndUpdate(
      user_id,
      { $set: data },
      {
        new: true,
      }
    );
    res.status(200).json({ message: 'User updated' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};
exports.getProfile = async (req, res) => {
  console.log(req.user);
  const user_id = req.user?._id || req.user?.user_id;
  try {
    const user = await User.findById(user_id)
      .select('-password')
      .populate('role')
      .populate('status');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.changeSession = async (req, res) => {
  const newSession = req.query.session;
  const user_id = req.user._id;
  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updatedUser = await User.findByIdAndUpdate(
      user_id,
      { chatSession: newSession },
      { new: true }
    );
    res
      .status(200)
      .json({ message: 'Session changed successfully', newSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
