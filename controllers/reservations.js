const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');
const User = require('../models/User');
const { generateQR } = require('../utils/qrcode');
const sendEmail = require('../utils/email');

//@desc     Get reservation details publicly (for QR scan, no auth)
//@route    GET /api/v1/reservations/public/:id
//@access   Public
exports.getReservationPublic = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate({ path: 'coworkingSpace', select: 'name address tel opentime closetime' })
            .populate({ path: 'user', select: 'name tel email' });

        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        res.status(200).json({ success: true, data: reservation });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Cannot find reservation' });
    }
};

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Private
exports.getReservations = async (req, res, next) => {
    let query;

    let queryFilter = {};
    if (req.user.role !== 'admin') {
        queryFilter.user = req.user.id;
    }
    else if (req.params.coworkingSpaceId) {
        queryFilter.coworkingSpace = req.params.coworkingSpaceId;
    }

    query = Reservation.find(queryFilter).populate({
        path: 'coworkingSpace',
        select: 'name address tel opentime closetime'
    });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Reservation.countDocuments(queryFilter);

    query = query.skip(startIndex).limit(limit);

    try {
        const reservations = await query;

        const pagination = {};
        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({
            success: true,
            count: reservations.length,
            pagination,
            data: reservations
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot find Reservation" });
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
                message: `User ${req.user.id} is not authorized to view this reservation`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot find Reservation" });
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
                message: "Cannot create a reservation without coworking space context"
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

        const resvDate = new Date(req.body.apptDate);
        const resvTimeString = resvDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

        if (resvTimeString < coworkingSpace.opentime || resvTimeString > coworkingSpace.closetime) {
            return res.status(400).json({
                success: false,
                message: `The coworking space is open from ${coworkingSpace.opentime} to ${coworkingSpace.closetime}. Please choose a valid time.`
            });
        }

        const conflictReservation = await Reservation.findOne({
            user: req.user.id,
            coworkingSpace: req.params.coworkingSpaceId,
            apptDate: req.body.apptDate
        });

        if (conflictReservation) {
            return res.status(400).json({
                success: false,
                message: `You have already booked this space at this exact time.`
            });
        }

        req.body.user = req.user.id;

        const existedReservations = await Reservation.find({ user: req.user.id, apptDate: { $gte: new Date() } });

        if (existedReservations.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `The user with ID ${req.user.id} has already made 3 Reservations`
            });
        }

        const reservation = await Reservation.create(req.body);

        // Generate QR code
        const qrCode = await generateQR({
            reservationId: reservation._id,
            userId: req.user.id,
            coworkingSpaceId: req.params.coworkingSpaceId,
            apptDate: reservation.apptDate
        });

        // Send email notification (non-fatal)
        try {
            const user = await User.findById(req.user.id);
            if (user && user.email) {
                await sendEmail({
                    to: user.email,
                    subject: 'Booking Confirmed - CoWork Space',
                    html: `
                        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
                            <h2 style="color:#2563EB">Booking Confirmed!</h2>
                            <p>Hi <strong>${user.name}</strong>,</p>
                            <p>Your reservation at <strong>${coworkingSpace.name}</strong> is confirmed.</p>
                            <table style="width:100%;border-collapse:collapse;margin:16px 0">
                                <tr><td style="padding:8px;color:#64748B">Space</td><td style="padding:8px"><strong>${coworkingSpace.name}</strong></td></tr>
                                <tr><td style="padding:8px;color:#64748B">Address</td><td style="padding:8px">${coworkingSpace.address}</td></tr>
                                <tr><td style="padding:8px;color:#64748B">Date &amp; Time</td><td style="padding:8px"><strong>${new Date(reservation.apptDate).toLocaleString('en-GB')}</strong></td></tr>
                                <tr><td style="padding:8px;color:#64748B">Booking ID</td><td style="padding:8px">${reservation._id}</td></tr>
                            </table>
                            <p style="color:#64748B;font-size:14px">You can cancel up to 1 hour before your booking time.</p>
                        </div>
                    `
                });
            }
        } catch (emailErr) {
            console.log('Email notification failed (non-fatal):', emailErr.message);
        }

        res.status(200).json({
            success: true,
            data: { ...reservation.toObject(), qrCode }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot create Reservation" });
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No Reservation with the id of ${req.params.id}` });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: `User ${req.user.id} is not authorized to update this Reservation` });
        }

        // 1-hour deadline check
        if (req.user.role !== 'admin') {
            const oneHourBefore = new Date(reservation.apptDate.getTime() - 60 * 60 * 1000);
            if (new Date() > oneHourBefore) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot modify reservation within 1 hour of the booked time'
                });
            }
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: reservation });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot update Reservation" });
    }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No Reservation with the id of ${req.params.id}` });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: `User ${req.user.id} is not authorized to delete this Reservation` });
        }

        // 1-hour deadline check
        if (req.user.role !== 'admin') {
            const oneHourBefore = new Date(reservation.apptDate.getTime() - 60 * 60 * 1000);
            if (new Date() > oneHourBefore) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot modify reservation within 1 hour of the booked time'
                });
            }
        }

        await reservation.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot delete Reservation" });
    }
};
