const pad = (value) => String(value).padStart(2, "0");

const getDateString = (date) => {
  const year  = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day   = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const getCurrentHHMM = () => {
  return new Date()
    .toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    })
    .slice(0, 5);
};

module.exports = { pad, getDateString, getCurrentHHMM };