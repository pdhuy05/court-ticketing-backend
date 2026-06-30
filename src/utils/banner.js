// src/utils/banner.js

const printServerBanner = (port) => {
  const now = new Date().toLocaleString("vi-VN");
  console.log(`
\x1b[90m ╔══════════════════════════════════════════════════════╗\x1b[0m
\x1b[90m ║\x1b[0m          \x1b[1m\x1b[36mQUEUE MANAGEMENT SYSTEM\x1b[0m                     \x1b[90m║\x1b[0m
\x1b[90m ╠══════════════════════════════════════════════════════╣\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[42m\x1b[30m OK \x1b[0m  Server khởi động thành công                   \x1b[90m║\x1b[0m
\x1b[90m ╠══════════════════════════════════════════════════════╣\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[90mURL    \x1b[0m  \x1b[1m\x1b[33mhttp://localhost:${port}\x1b[0m                      \x1b[90m║\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[90mPort   \x1b[0m  \x1b[1m${port}\x1b[0m                                       \x1b[90m║\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[90mTime   \x1b[0m  ${now}                         \x1b[90m║\x1b[0m
\x1b[90m ╠══════════════════════════════════════════════════════╣\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[90mDev    \x1b[0m  \x1b[1m\x1b[35mPhạm Đình Huy\x1b[0m                              \x1b[90m║\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[90mCEO    \x1b[0m  \x1b[1m\x1b[33mNguyễn Cao Trí\x1b[0m                             \x1b[90m║\x1b[0m
\x1b[90m ╠══════════════════════════════════════════════════════╣\x1b[0m
\x1b[90m ║\x1b[0m  \x1b[32m© 2026 Phạm Đình Huy\x1b[0m · All rights reserved          \x1b[90m║\x1b[0m
\x1b[90m ╚══════════════════════════════════════════════════════╝\x1b[0m
`);
};

const printSchedulerBanner = (results, labels) => {
  const lines = results.map((result, i) => {
    const isLast  = i === results.length - 1;
    const prefix  = isLast ? "\x1b[90m └─\x1b[0m" : "\x1b[90m ├─\x1b[0m";
    if (result.status === "fulfilled") {
      return `${prefix} \x1b[32m OK\x1b[0m  ${labels[i]}`;
    } else {
      return `${prefix} \x1b[31m ER\x1b[0m  ${labels[i]}\x1b[90m → ${result.reason?.message}\x1b[0m`;
    }
  });

  console.log(`\x1b[90m ┌─\x1b[0m \x1b[1m\x1b[36mSchedulers\x1b[0m\n${lines.join("\n")}\n`);
};

module.exports = { printServerBanner, printSchedulerBanner };