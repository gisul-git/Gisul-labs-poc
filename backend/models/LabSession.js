const mongoose = require('mongoose');

const LabSessionSchema = new mongoose.Schema({
  userId:         { type: String, required: true },
  vmId:           { type: Number, required: true },
  labId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  status:         { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  completedSteps: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('LabSession', LabSessionSchema);
