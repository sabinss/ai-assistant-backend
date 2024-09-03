const Role = require('../models/Role');
exports.getRoles = async (req, res, next) => {
    try {
        const roles = await Role.find();

        res.status(200).json({
            success: true,
            count: roles.length,
            data: roles
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Cannot find roles'
        });
    }
};


exports.getRole = async (req, res, next) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({
                success: false,
                error: 'No role found'
            });
        }

        res.status(200).json({
            success: true,
            data: role
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Cannot find role'
        });
    }
};

exports.createRole = async (req, res, next) => {
    try {
        const role = await Role.create(req.body);

        res.status(201).json({
            success: true,
            data: role
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Cannot create role'
        });
    }
};

exports.updateRole = async (req, res, next) => {
    try {
        const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                error: 'No role found'
            });
        }

        res.status(200).json({
            success: true,
            data: role
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Cannot update role'
        });
    }
};

exports.deleteRole = async (req, res, next) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({
                success: false,
                error: 'No role found'
            });
        }

        await role.remove();

        res.status(200).json({
            success: true,
            data: {}
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Cannot delete role'
        });
    }
};
