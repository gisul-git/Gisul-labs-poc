const mongoose = require('mongoose');

// Stores daily uptime buckets per VM
const VmUptimeSchema = new mongoose.Schema({
  vmid:       { type: Number, required: true },
  date:       { type: String, required: true }, // 'YYYY-MM-DD'
  seconds:    { type: Number, default: 0 },     // total seconds running that day
}, { timestamps: false });

VmUptimeSchema.index({ vmid: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('VmUptime', VmUptimeSchema);
