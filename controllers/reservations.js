const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');
const User = require('../models/User');
const { generateQR } = require('../utils/qrcode');
const sendEmail = require('../utils/email');
const BANGKOK_TIMEZONE = 'Asia/Bangkok';
const DEFAULT_DURATION_MINUTES = 60;

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseHHMMToMinutes = (timeStr) => {
    const [hourStr, minuteStr] = String(timeStr || '').split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return (hour * 60) + minute;
};

const getBangkokTimeParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: BANGKOK_TIMEZONE
    }).formatToParts(date);

    return {
        hour: Number(parts.find((part) => part.type === 'hour')?.value),
        minute: Number(parts.find((part) => part.type === 'minute')?.value),
        second: Number(parts.find((part) => part.type === 'second')?.value)
    };
};

const isWithinOperatingHours = (date, openTime, closeTime) => {
    const openMinutes = parseHHMMToMinutes(openTime);
    const closeMinutes = parseHHMMToMinutes(closeTime);
    if (openMinutes === null || closeMinutes === null) return false;

    const { hour, minute } = getBangkokTimeParts(date);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
    const reservationMinutes = (hour * 60) + minute;

    return reservationMinutes >= openMinutes && reservationMinutes <= closeMinutes;
};

const isOnHourlySlot = (date) => {
    const { minute, second } = getBangkokTimeParts(date);
    if (!Number.isInteger(minute) || !Number.isInteger(second)) return false;
    return minute === 0 && second === 0;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + (minutes * 60 * 1000));

const getReservationEnd = (reservation) => {
    if (reservation && isValidDate(new Date(reservation.apptEnd))) {
        return new Date(reservation.apptEnd);
    }
    return addMinutes(new Date(reservation.apptDate), DEFAULT_DURATION_MINUTES);
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

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

        const resvStart = new Date(req.body.apptDate);
        const resvEnd = req.body.apptEnd ? new Date(req.body.apptEnd) : addMinutes(resvStart, DEFAULT_DURATION_MINUTES);

        if (!isValidDate(resvStart) || !isValidDate(resvEnd)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid reservation start/end date and time.'
            });
        }

        if (resvEnd <= resvStart) {
            return res.status(400).json({
                success: false,
                message: 'Reservation end time must be after start time.'
            });
        }

        if (!isOnHourlySlot(resvStart) || !isOnHourlySlot(resvEnd)) {
            return res.status(400).json({
                success: false,
                message: 'Please select reservation start and end on the hour (e.g., 10:00, 11:00).'
            });
        }

        if (resvStart <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date and time must be in the future.'
            });
        }

        if (
            !isWithinOperatingHours(resvStart, coworkingSpace.opentime, coworkingSpace.closetime) ||
            !isWithinOperatingHours(resvEnd, coworkingSpace.opentime, coworkingSpace.closetime)
        ) {
            return res.status(400).json({
                success: false,
                message: `The coworking space is open from ${coworkingSpace.opentime} to ${coworkingSpace.closetime}. Please choose a valid reservation range.`
            });
        }

        const userSpaceReservations = await Reservation.find({
            user: req.user.id,
            coworkingSpace: req.params.coworkingSpaceId
        });

        const hasConflict = userSpaceReservations.some((existing) => {
            const existingStart = new Date(existing.apptDate);
            const existingEnd = getReservationEnd(existing);
            return rangesOverlap(existingStart, existingEnd, resvStart, resvEnd);
        });

        if (hasConflict) {
            return res.status(400).json({
                success: false,
                message: 'You already have a reservation that overlaps this selected range.'
            });
        }

        req.body.user = req.user.id;
        req.body.apptDate = resvStart;
        req.body.apptEnd = resvEnd;

        const existedReservations = await Reservation.find({ user: req.user.id, apptDate: { $gte: new Date() } });

        if (existedReservations.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'You have already made 3 reservations. Please cancel an existing one before booking again.'
            });
        }

        const reservation = await Reservation.create(req.body);

        // Generate QR code and persist it (non-fatal)
        let qrCode = null;
        try {
            qrCode = await generateQR({
                reservationId: reservation._id,
                userId: req.user.id,
                coworkingSpaceId: req.params.coworkingSpaceId,
                apptDate: reservation.apptDate
            });
            if (qrCode) {
                reservation.qrCode = qrCode;
                await reservation.save();
            }
        } catch (qrErr) {
            console.log('QR generation failed (non-fatal):', qrErr.message);
        }

        // Send email notification (non-fatal)
        try {
            const user = await User.findById(req.user.id);
            if (user && user.email) {
                let emailAttachments = [];
                let qrEmailBlock = '';

                if (typeof qrCode === 'string' && qrCode.startsWith('data:image/')) {
                    const matches = qrCode.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
                    if (matches) {
                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        const ext = mimeType.split('/')[1] || 'png';
                        emailAttachments = [{
                            filename: `booking-qr.${ext}`,
                            content: Buffer.from(base64Data, 'base64'),
                            contentType: mimeType,
                            cid: 'booking-qr'
                        }];

                        qrEmailBlock = `
                            <div style="margin:16px 0;text-align:center">
                                <img src="cid:booking-qr" alt="Booking QR Code" style="width:180px;height:180px;display:block;margin:0 auto" />
                                <p style="margin-top:8px;color:#64748B;font-size:13px">Show this QR code at check-in.</p>
                            </div>
                        `;
                    }
                }

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
                                <tr><td style="padding:8px;color:#64748B">Date &amp; Time</td><td style="padding:8px"><strong>${new Date(reservation.apptDate).toLocaleString('en-GB')} - ${new Date(reservation.apptEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong></td></tr>
                                <tr><td style="padding:8px;color:#64748B">Booking ID</td><td style="padding:8px">${reservation._id}</td></tr>
                            </table>
                            ${qrEmailBlock}
                            <p style="color:#64748B;font-size:14px">You can cancel up to 1 hour before your booking time.</p>
                        </div>
                    `,
                    attachments: emailAttachments
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

        const currentStart = new Date(reservation.apptDate);
        const currentEnd = getReservationEnd(reservation);
        const currentDurationMs = currentEnd.getTime() - currentStart.getTime();

        if (!req.body.apptDate && !req.body.apptEnd) {
            return res.status(400).json({
                success: false,
                message: 'Please provide apptDate or apptEnd to update reservation.'
            });
        }

        const nextApptDate = req.body.apptDate ? new Date(req.body.apptDate) : currentStart;
        const nextApptEnd = req.body.apptEnd
            ? new Date(req.body.apptEnd)
            : (req.body.apptDate ? new Date(nextApptDate.getTime() + currentDurationMs) : currentEnd);

        if (!isValidDate(nextApptDate) || !isValidDate(nextApptEnd)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid reservation start/end date and time.'
            });
        }

        if (nextApptEnd <= nextApptDate) {
            return res.status(400).json({
                success: false,
                message: 'Reservation end time must be after start time.'
            });
        }

        if (!isOnHourlySlot(nextApptDate) || !isOnHourlySlot(nextApptEnd)) {
            return res.status(400).json({
                success: false,
                message: 'Please select reservation start and end on the hour (e.g., 10:00, 11:00).'
            });
        }

        if (nextApptDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date and time must be in the future.'
            });
        }

        const coworkingSpace = await CoworkingSpace.findById(reservation.coworkingSpace);
        if (!coworkingSpace) {
            return res.status(404).json({
                success: false,
                message: `No coworkingSpace with the id of ${reservation.coworkingSpace}`
            });
        }

        if (
            !isWithinOperatingHours(nextApptDate, coworkingSpace.opentime, coworkingSpace.closetime) ||
            !isWithinOperatingHours(nextApptEnd, coworkingSpace.opentime, coworkingSpace.closetime)
        ) {
            return res.status(400).json({
                success: false,
                message: `The coworking space is open from ${coworkingSpace.opentime} to ${coworkingSpace.closetime}. Please choose a valid reservation range.`
            });
        }

        const userSpaceReservations = await Reservation.find({
            _id: { $ne: reservation._id.toString() },
            user: reservation.user,
            coworkingSpace: reservation.coworkingSpace
        });

        const hasConflict = userSpaceReservations.some((existing) => {
            const existingStart = new Date(existing.apptDate);
            const existingEnd = getReservationEnd(existing);
            return rangesOverlap(existingStart, existingEnd, nextApptDate, nextApptEnd);
        });

        if (hasConflict) {
            return res.status(400).json({
                success: false,
                message: 'You already have a reservation that overlaps this selected range.'
            });
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, {
            apptDate: nextApptDate,
            apptEnd: nextApptEnd
        }, {
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
