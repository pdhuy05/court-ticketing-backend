const pad = (value) => String(value).padStart(2, '0');

/** “Hiện tại” theo offset phút so với đồng hồ server (VD Việt Nam +420 = UTC+7). */
const getAppNow = () => {
    const offsetMin = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES);
    const ms = Number.isFinite(offsetMin) && offsetMin !== 0 ? offsetMin * 60 * 1000 : 0;
    return new Date(Date.now() + ms);
};

const getDateString = (date) => {
    const d = date instanceof Date ? date : getAppNow();
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    return `${year}-${month}-${day}`;
};

const getCurrentHHMM = () => {
    const now = getAppNow();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

module.exports = { pad, getDateString, getCurrentHHMM, getAppNow };
