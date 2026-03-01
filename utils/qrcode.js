const QRCode = require('qrcode');

exports.generateQR = async (data) => {
    if (process.env.IS_LOCAL === 'true') {
        const url = `http://localhost:${process.env.PORT || 5000}/booking.html?id=${data.reservationId}`;
        return await QRCode.toDataURL(url);
    }
    return await QRCode.toDataURL(JSON.stringify(data));
};
