require('dotenv').config();

const path = require('path');
const mongoose = require('mongoose');

const env = require(path.join(__dirname, '../src/config/env'));
const Ticket = require(path.join(__dirname, '../src/models/ticket.model'));

const LEGACY_UNIQUE_INDEX_NAMES = [
    'unique_queueCounterId_number',
    'unique_queueCounterId_ticketNumber'
];

async function dropLegacyUniqueIndexes () {
    const coll = Ticket.collection;
    for (const name of LEGACY_UNIQUE_INDEX_NAMES) {
        try {
            await coll.dropIndex(name);
            console.log(`Dropped index: ${name}`);
        } catch (err) {
            if (err.code === 27 || err.codeName === 'IndexNotFound') {
                console.log(`Index không tồn tại, bỏ qua: ${name}`);
            } else {
                throw err;
            }
        }
    }
}

async function backfillDateFromCreatedAt () {
    const res = await Ticket.collection.updateMany(
        {
            $or: [
                { date: { $exists: false } },
                { date: null },
                { date: '' }
            ]
        },
        [
            {
                $set: {
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                            timezone: 'Asia/Ho_Chi_Minh'
                        }
                    }
                }
            }
        ]
    );

    console.log(`Backfill date: matched=${res.matchedCount}, modified=${res.modifiedCount}`);
}

async function syncTicketIndexes () {
    await Ticket.syncIndexes();
    console.log('Ticket.syncIndexes() hoàn tất.');
}

async function main () {
    if (!env.db) {
        console.error('Thiếu biến môi trường MONGODB_URI (env.db).');
        process.exit(1);
    }

    await mongoose.connect(env.db);
    try {
        await dropLegacyUniqueIndexes();
        await backfillDateFromCreatedAt();
        await syncTicketIndexes();
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
