/**
 * Migration: thêm uniqueness theo ngày cho vé (Ticket.date + index compound).
 *
 * Bước 1 — Drop unique index cũ (không có date).
 * Bước 2 — Backfill date YYYY-MM-DD từ createdAt (timezone Asia/Ho_Chi_Minh).
 * Bước 3 — syncIndexes() theo ticket.model.js mới (tạo unique_queueCounterId_*_date).
 *
 * Chạy từ thư mục gốc repo: node scripts/migrate-ticket-date-indexes.js
 *
 * ---
 * Kiểm thử thủ công (manual test cases sau khi deploy):
 * - Ngày A phát vé → lastNumber trong CounterSequence tăng; vé có number 1,2,3…
 * - Sau reset ngày (resetTicketsByDate / auto) lastNumber về 0; ngày B phát lại từ 1
 * - Cùng queueCounterId, khác date → cùng number vẫn insert được (không E11000)
 * - Hai request tạo vé cùng ngày → CounterSequence $inc vẫn serialize, không trùng number
 */

require('dotenv').config();

const path = require('path');
const mongoose = require('mongoose');

// resolve config/model từ project root khi cwd là repo root
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
