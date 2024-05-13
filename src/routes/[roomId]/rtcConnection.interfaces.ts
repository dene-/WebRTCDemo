export interface RtcConnection {
  id: string;
  user: User;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  stream?: MediaStream;
}

export interface ChatMessage {
  userId: string;
  content: string;
  timestamp: number;
}

export interface User {
  roomId: string;
  userId: string;
  username: string;
}