const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    reservDate: {
        type: Date,
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    coworkingSpace: {
        type: mongoose.Schema.ObjectId,
        ref: 'CoworkingSpace',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

ReservationSchema.index({ user: 1, reservDate: 1 });
ReservationSchema.index({ coworkingSpace: 1, reservDate: 1 }, { unique: true });

module.exports = mongoose.model('Reservation', ReservationSchema);
