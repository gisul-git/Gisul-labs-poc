const mongoose = require('mongoose');

const StepSchema = new mongoose.Schema({
  stepId:     { type: String, required: true },
  title:      { type: String, required: true },
  type:       { type: String, default: 'action' },
  scriptType: { type: String, default: 'powershell' },
  command:    { type: String, required: true },
  // Human-readable instructions shown in the sidebar
  instructions: { type: String, default: '' },
}, { _id: false });

const LabSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  description:{ type: String, default: '' },
  templateId: { type: Number, required: true },
  steps:      [StepSchema],
}, { timestamps: true });

module.exports = mongoose.model('Lab', LabSchema);
