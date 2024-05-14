export const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { 
    urls: 'turn:turn.terminaldogma.win:1985',
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