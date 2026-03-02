const QRCode = require('qrcode');

exports.generateQR = async (data) => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const url = `${baseUrl}/booking.html?id=${data.reservationId}`;
    return await QRCode.toDataURL(url);
};
