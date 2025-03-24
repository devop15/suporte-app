const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const CallSchema = new mongoose.Schema({
    name: String,
    start: String,
    end: String,
    duration: Number,
});

const Call = mongoose.model('Call', CallSchema);

module.exports = { Call };