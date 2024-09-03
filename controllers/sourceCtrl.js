const Source = require("../models/Source");

// Get all sources
exports.getSources = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        const sortField = req.query.sortField || "name";
        const sortDirection = req.query.sortDirection === "desc" ? -1 : 1;

        const searchCondition = {
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { organization: { $regex: searchQuery, $options: 'i' } },
                { status: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        const sources = await Source.find(searchCondition)
            .skip(startIndex)
            .limit(limit)
            .sort({ [sortField]: sortDirection });

        const totalSources = await Source.countDocuments(searchCondition);
        const totalPages = Math.ceil(totalSources / limit);
        res.status(200).json({ sources, totalPages });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};
// Get a single source
exports.getSource = async (req, res) => {
    const sourceId = req.params.id;
    try {
        const source = await Source.findById(sourceId);
        if (!source) return res.status(404).json({ message: "Source not found" });
        res.status(200).json(source);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Create a new source
exports.createSource = async (req, res) => {
    const { organization, name, status } = req.body;
    try {
        const existingSource = await Source.findOne({ organization });
        if (existingSource) {
            return res.status(400).json({ message: "Organization already exists" });
        }
        const newSource = await Source.create({ organization, name, status });
        res.status(201).json(newSource);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Update a source
exports.updateSource = async (req, res) => {
    const sourceId = req.params.id;
    const { organization, name, status } = req.body;
    try {
        const updatedSource = await Source.findByIdAndUpdate(
            sourceId,
            { organization, name, status },
            { new: true }
        );
        if (!updatedSource) return res.status(404).json({ message: "Source not found" });
        res.status(200).json(updatedSource);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

// Delete a source
exports.deleteSource = async (req, res) => {
    const sourceId = req.params.id;
    try {
        const deletedSource = await Source.findByIdAndDelete(sourceId);
        if (!deletedSource) return res.status(404).json({ message: "Source not found" });
        res.status(200).json({ message: "Source deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};