import { io } from 'socket.io-client';

export function createSocket() {
  const token = localStorage.getItem('mana_token');
  return io({ auth: { token } });
}
