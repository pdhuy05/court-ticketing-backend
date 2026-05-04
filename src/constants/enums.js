const TicketStatus = {
  WAITING: 'waiting',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
};

const ActiveStatus = {
  ACTIVE: true,
  INACTIVE: false
};

const ConnectPrint = {
  USB: 'usb',           
  NETWORK: 'network',   
  BLUETOOTH: 'bluetooth' 
};

const ShiftAction = {
  START: 'start',
  END: 'end'
};

module.exports = {
  TicketStatus,
  ActiveStatus,
  ConnectPrint,
  ShiftAction
};
