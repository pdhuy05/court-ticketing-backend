const TicketStatus = {
  WAITING: 'waiting',
  CALLED: 'called',
  PROCESSING: 'processing',
  DONE: 'done'
};

const ServiceCode = {
  NOP_DON: 'ND',
  NHAN_KET_QUA: 'KQ',
  TU_VAN: 'TV',
  KHIEU_NAI: 'KN',
  HANH_CHINH: 'HC',
  KHAC: 'KH'
};

const ServiceName = {
  ND: 'Nộp đơn',
  KQ: 'Nhận kết quả',
  TV: 'Tư vấn',
  KN: 'Khiếu nại',
  HC: 'Hành chính',
  KH: 'Khác'
};

const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER'
};

const ActiveStatus = {
  ACTIVE: true,
  INACTIVE: false
};

module.exports = {
  TicketStatus,
  ServiceCode,
  ServiceName,
  Gender,
  ActiveStatus
};