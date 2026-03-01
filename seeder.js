const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: './config/config.env' });

const User = require('./models/User');
const CoworkingSpace = require('./models/CoworkingSpace');

const users = [
    {
        name: 'Admin',
        tel: '0812345678',
        email: 'admin@cowork.com',
        password: 'admin1234',
        role: 'admin'
    },
    {
        name: 'Alice Johnson',
        tel: '0823456789',
        email: 'alice@example.com',
        password: 'password123',
        role: 'user'
    },
    {
        name: 'Bob Smith',
        tel: '0834567890',
        email: 'bob@example.com',
        password: 'password123',
        role: 'user'
    }
];

const coworkingSpaces = [
    {
        name: 'The Hive Bangkok',
        address: '68 Sukhumvit Soi 55, Watthana, Bangkok 10110',
        tel: '0221234567',
        opentime: '08:00',
        closetime: '22:00'
    },
    {
        name: 'Hubba Ekkamai',
        address: '42 Ekkamai Road, Wattana, Bangkok 10110',
        tel: '0222345678',
        opentime: '09:00',
        closetime: '21:00'
    },
    {
        name: 'CAMP Silom',
        address: '191 Silom Road, Silom, Bang Rak, Bangkok 10500',
        tel: '0223456789',
        opentime: '07:00',
        closetime: '23:00'
    },
    {
        name: 'WeWork Sathorn',
        address: '1 Empire Tower, South Sathorn Road, Yannawa, Bangkok 10120',
        tel: '0224567890',
        opentime: '08:00',
        closetime: '20:00'
    },
    {
        name: 'Mango Space Ari',
        address: '7/1 Phahon Yothin Road, Samsennai, Phaya Thai, Bangkok 10400',
        tel: '0225678901',
        opentime: '08:00',
        closetime: '20:00'
    }
];

const seedDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Clear existing data
    await User.deleteMany();
    await CoworkingSpace.deleteMany();
    console.log('Cleared existing data');

    // Insert coworking spaces
    await CoworkingSpace.insertMany(coworkingSpaces);
    console.log(`Inserted ${coworkingSpaces.length} coworking spaces`);

    // Insert users (passwords will be hashed by the pre-save hook)
    for (const u of users) {
        await User.create(u);
    }
    console.log(`Inserted ${users.length} users`);

    console.log('\n=== SEED COMPLETE ===');
    console.log('Admin credentials:');
    console.log('  Email:    admin@cowork.com');
    console.log('  Password: admin1234');
    console.log('\nLogin at: POST /api/v1/auth/login');

    await mongoose.disconnect();
    process.exit(0);
};

seedDB().catch(err => {
    console.error(err);
    process.exit(1);
});
