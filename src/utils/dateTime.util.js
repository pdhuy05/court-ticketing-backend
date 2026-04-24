const pad = (value) => String(value).padStart(2, '0');

const getDateString = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const getCurrentHHMM = () => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

module.exports = { pad, getDateString, getCurrentHHMM };
