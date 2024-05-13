import { iceServers } from "../routes/[roomId]/rtcConnection.const";

export class PeerPeer {
  private peerConnection: RTCPeerConnection;

  constructor() {
    this.peerConnection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(description);
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }
}