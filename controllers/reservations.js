const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

const parseTime = (hhmm) => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return (hours * 60) + minutes;
};

const isWithinOpeningHours = (dateValue, openTime, closeTime) => {
    const date = new Date(dateValue);
    const reservationMins = (date.getHours() * 60) + date.getMinutes();
    const openMins = parseTime(openTime);
    const closeMins = parseTime(closeTime);
    return reservationMins >= openMins && reservationMins < closeMins;
};

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Private
exports.getReservations = async (req, res, next) => {
    let query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const startIndex = (page - 1) * limit;

    // General users can see only their reservations
    if (req.user.role !== 'admin') {
        query = Reservation.find({ user: req.user.id }).populate({
            path: 'coworkingSpace',
            select: 'name address tel opentime closetime'
        });
    } else if (req.params.coworkingSpaceId) {
        query = Reservation.find({ coworkingSpace: req.params.coworkingSpaceId }).populate({
            path: 'coworkingSpace',
            select: 'name address tel opentime closetime'
        });
    } else {
        query = Reservation.find().populate({
            path: 'coworkingSpace',
            select: 'name address tel opentime closetime'
        });
    }

    try {
        const reservations = await query.skip(startIndex).limit(limit).sort('-reservDate');

        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot find Reservation'
        });
    }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Private
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate({
            path: 'coworkingSpace',
            select: 'name address tel opentime closetime'
        });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No Reservation with the id of ${req.params.id}`
            });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to access this Reservation`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot find Reservation'
        });
    }
};

//@desc     Add reservation
//@route    POST /api/v1/coworkingSpaces/:coworkingSpaceId/reservations
//@access   Private
exports.addReservation = async (req, res, next) => {
    try {
        if (!req.params.coworkingSpaceId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide coworkingSpaceId in route /coworkingSpaces/:coworkingSpaceId/reservations'
            });
        }

        req.body.coworkingSpace = req.params.coworkingSpaceId;

        const coworkingSpace = await CoworkingSpace.findById(req.params.coworkingSpaceId);
        if (!coworkingSpace) {
            return res.status(404).json({
                success: false,
                message: `No coworkingSpace with the id of ${req.params.coworkingSpaceId}`
            });
        }

        req.body.user = req.user.id;

        const reservationDate = new Date(req.body.reservDate);
        if (Number.isNaN(reservationDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservDate'
            });
        }

        if (!isWithinOpeningHours(reservationDate, coworkingSpace.opentime, coworkingSpace.closetime)) {
            return res.status(400).json({
                success: false,
                message: `Reservation time must be within opening hours (${coworkingSpace.opentime}-${coworkingSpace.closetime})`
            });
        }

        const existedReservations = await Reservation.countDocuments({
            user: req.user.id,
            reservDate: { $gte: new Date() }
        });

        if (existedReservations >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `The user with ID ${req.user.id} has already made 3 Reservations`
            });
        }

        const conflictingReservation = await Reservation.findOne({
            coworkingSpace: req.params.coworkingSpaceId,
            reservDate: reservationDate
        });

        if (conflictingReservation) {
            return res.status(409).json({
                success: false,
                message: 'This reservation slot is already booked'
            });
        }

        req.body.reservDate = reservationDate;
        const reservation = await Reservation.create(req.body);

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot create Reservation'
        });
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No Reservation with the id of ${req.params.id}`
            });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to update this Reservation`
            });
        }

        const nextCoworkingSpaceId = req.body.coworkingSpace || reservation.coworkingSpace.toString();
        const nextReservationDate = req.body.reservDate ? new Date(req.body.reservDate) : reservation.reservDate;

        if (req.body.reservDate && Number.isNaN(nextReservationDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservDate'
            });
        }

        const coworkingSpace = await CoworkingSpace.findById(nextCoworkingSpaceId);
        if (!coworkingSpace) {
            return res.status(404).json({
                success: false,
                message: `No coworkingSpace with the id of ${nextCoworkingSpaceId}`
            });
        }

        if (!isWithinOpeningHours(nextReservationDate, coworkingSpace.opentime, coworkingSpace.closetime)) {
            return res.status(400).json({
                success: false,
                message: `Reservation time must be within opening hours (${coworkingSpace.opentime}-${coworkingSpace.closetime})`
            });
        }

        const conflictingReservation = await Reservation.findOne({
            _id: { $ne: req.params.id },
            coworkingSpace: nextCoworkingSpaceId,
            reservDate: nextReservationDate
        });

        if (conflictingReservation) {
            return res.status(409).json({
                success: false,
                message: 'This reservation slot is already booked'
            });
        }

        req.body.reservDate = nextReservationDate;
        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot update Reservation'
        });
    }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No Reservation with the id of ${req.params.id}`
            });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to delete this Reservation`
            });
        }

        await reservation.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot delete Reservation'
        });
    }
};
