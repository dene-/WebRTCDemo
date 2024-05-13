export const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { 
    urls: 'turn:localhost:3478',
    username: 'fulanito',
    credential: 'menganito'
  }
];

export const DATA_CHANNEL = 'chat';

export const MESSAGE_TYPE = {
  connect: 'connect',
  offer: 'offer',
  answer: 'answer',
  candidate: 'candidate',
  disconnect: 'disconnect',
}